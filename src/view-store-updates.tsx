import { ActionPanel, Action, List, Icon, Keyboard, Detail, Color, getPreferenceValues } from "@raycast/api";
import { useFetch, useCachedPromise } from "@raycast/utils";
import { useState, useMemo, useEffect } from "react";

interface Preferences {
  platformFilter: "all" | "macOS" | "windows";
}

// =============================================================================
// Types
// =============================================================================

interface FeedAuthor {
  name: string;
  url: string;
}

interface FeedItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  image: string;
  date_modified: string;
  author: FeedAuthor;
}

interface Feed {
  version: string;
  title: string;
  home_page_url: string;
  description: string;
  icon: string;
  items: FeedItem[];
}

interface GitHubPR {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  user: {
    login: string;
    html_url: string;
    avatar_url: string;
  };
  labels: { name: string }[];
}

/** Unified item displayed in the list */
interface StoreItem {
  id: string;
  title: string;
  summary: string;
  image: string;
  date: string;
  authorName: string;
  authorUrl: string;
  url: string;
  type: "new" | "updated";
  /** For updated extensions: slug used to fetch changelog */
  extensionSlug?: string;
  /** GitHub PR URL for updated extensions */
  prUrl?: string;
  /** Supported platforms */
  platforms?: string[];
  /** Extension version from package.json */
  version?: string;
  /** Extension categories from package.json */
  categories?: string[];
}

type FilterValue = "all" | "new" | "updated";

// =============================================================================
// Constants
// =============================================================================

const FEED_URL = "https://www.raycast.com/store/feed.json";
const GITHUB_PRS_URL =
  "https://api.github.com/repos/raycast/extensions/pulls?state=closed&sort=updated&direction=desc&per_page=50";
const RAW_CONTENT_BASE = "https://raw.githubusercontent.com/raycast/extensions/main/extensions";
const GITHUB_EXTENSIONS_BASE = "https://github.com/raycast/extensions/blob/main/extensions";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parses the Raycast Store URL to extract author and extension name.
 * URL format: https://www.raycast.com/{author}/{extension}
 */
function parseExtensionUrl(url: string): { author: string; extension: string } {
  const path = url.replace("https://www.raycast.com/", "");
  const [author, extension] = path.split("/");
  return { author, extension };
}

/**
 * Creates a Raycast deeplink to open an extension in the Store.
 * Format: raycast://extensions/{author}/{extension}
 */
function createStoreDeeplink(url: string): string {
  const { author, extension } = parseExtensionUrl(url);
  return `raycast://extensions/${author}/${extension}`;
}

/**
 * Attempts to extract the extension slug from a GitHub PR title.
 * Common PR title patterns:
 *   - "Extension Name: description"
 *   - "[Extension Name] description"
 *   - "Update extension-name"
 * Returns null if we can't reliably determine it.
 */
function parseExtensionSlugFromPR(pr: GitHubPR): string | null {
  // Check labels for extension slug (some PRs have "extension: name" labels)
  for (const label of pr.labels) {
    const match = label.name.match(/^extension:\s*(.+)$/i);
    if (match) return match[1].trim().toLowerCase().replace(/\s+/g, "-");
  }

  const title = pr.title;

  // Pattern: "Extension Name: description" or "extension-name: description"
  const colonMatch = title.match(/^([^:]+):\s/);
  if (colonMatch) {
    const name = colonMatch[1].trim();
    // Skip common prefixes that aren't extension names
    if (!/^(fix|feat|chore|docs|ci|build|refactor|test|style|perf|revert|bump|update|add|remove|merge)/i.test(name)) {
      return name.toLowerCase().replace(/\s+/g, "-");
    }
  }

  // Pattern: "[Extension Name] description"
  const bracketMatch = title.match(/^\[([^\]]+)\]/);
  if (bracketMatch) {
    return bracketMatch[1].trim().toLowerCase().replace(/\s+/g, "-");
  }

  return null;
}

/**
 * Extracts the most recent changelog section from a CHANGELOG.md string.
 * Looks for the first ## heading and returns content until the next ## heading.
 */
function extractLatestChanges(changelog: string): string {
  const lines = changelog.split("\n");
  let started = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (started) break; // We've hit the next section
      started = true;
      result.push(line);
      continue;
    }
    if (started) {
      result.push(line);
    }
  }

  return result.join("\n").trim();
}

/**
 * Fetches the package.json for an extension to get the correct owner/title.
 * Returns { owner, title } or null if not found.
 */
async function fetchExtensionPackageInfo(
  slug: string,
): Promise<{
  owner: string;
  title: string;
  name: string;
  description: string;
  platforms: string[];
  version: string;
  categories: string[];
} | null> {
  try {
    const response = await fetch(`${RAW_CONTENT_BASE}/${slug}/package.json`);
    if (!response.ok) return null;
    const pkg = (await response.json()) as {
      owner?: string;
      title?: string;
      name?: string;
      author?: string;
      description?: string;
      platforms?: string[];
      version?: string;
      categories?: string[];
    };
    const owner = pkg.owner ?? pkg.author ?? slug;
    const title = pkg.title ?? pkg.name ?? slug;
    const name = pkg.name ?? slug;
    const description = pkg.description ?? "";
    const platforms = pkg.platforms ?? ["macOS"];
    const version = pkg.version ?? "";
    const categories = pkg.categories ?? [];
    return { owner, title, name, description, platforms, version, categories };
  } catch {
    return null;
  }
}

/**
 * Converts merged GitHub PRs into StoreItems.
 * Filters for only merged PRs and deduplicates by extension slug.
 * Fetches package.json for each to get the correct store owner.
 */
async function convertPRsToStoreItems(prs: GitHubPR[], existingNewIds: Set<string>): Promise<StoreItem[]> {
  const seen = new Set<string>();
  const candidates: { pr: GitHubPR; slug: string }[] = [];

  for (const pr of prs) {
    if (!pr.merged_at) continue;

    const slug = parseExtensionSlugFromPR(pr);
    if (!slug || seen.has(slug)) continue;

    // Skip if this extension is already in the "new" list
    if (existingNewIds.has(slug)) continue;

    seen.add(slug);
    candidates.push({ pr, slug });
  }

  // Fetch package.json for all candidates in parallel
  const results = await Promise.all(
    candidates.map(async ({ pr, slug }) => {
      const pkgInfo = await fetchExtensionPackageInfo(slug);
      const owner = pkgInfo?.owner ?? pr.user.login;
      const title =
        pkgInfo?.title ??
        slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const description = pkgInfo?.description ?? pr.title;

      return {
        id: `pr-${pr.number}`,
        title,
        summary: description,
        image: pr.user.avatar_url,
        date: pr.merged_at!,
        authorName: pr.user.login,
        authorUrl: pr.user.html_url,
        url: `https://www.raycast.com/${owner}/${slug}`,
        type: "updated" as const,
        extensionSlug: slug,
        prUrl: pr.html_url,
        platforms: pkgInfo?.platforms ?? ["macOS"],
        version: pkgInfo?.version,
        categories: pkgInfo?.categories,
      };
    }),
  );

  return results;
}

// =============================================================================
// Hooks
// =============================================================================

function useChangelog(slug: string | undefined) {
  const url = slug ? `${RAW_CONTENT_BASE}/${slug}/CHANGELOG.md` : undefined;

  return useCachedPromise(
    async (fetchUrl: string) => {
      const response = await fetch(fetchUrl);
      if (!response.ok) return null;
      return response.text();
    },
    [url!],
    {
      execute: !!url,
    },
  );
}

// =============================================================================
// Components
// =============================================================================

function ChangelogDetail({ slug, title }: { slug: string; title: string }) {
  const { data: changelog, isLoading } = useChangelog(slug);

  const markdown = changelog ?? `# ${title}\n\nNo changelog available for this extension.`;

  return <Detail isLoading={isLoading} markdown={markdown} navigationTitle={`${title} — Changelog`} />;
}

function ExtensionActions({ item }: { item: StoreItem }) {
  const storeDeeplink = createStoreDeeplink(item.url);
  const changelogBrowserUrl = item.extensionSlug
    ? `${GITHUB_EXTENSIONS_BASE}/${item.extensionSlug}/CHANGELOG.md`
    : undefined;

  const { data: changelog } = useChangelog(item.extensionSlug);
  const latestChanges = changelog ? extractLatestChanges(changelog) : null;

  return (
    <ActionPanel>
      {item.extensionSlug && (
        <ActionPanel.Section title="Changelog">
          <Action.Push
            title="View Changelog"
            icon={Icon.Document}
            target={<ChangelogDetail slug={item.extensionSlug} title={item.title} />}
            shortcut={{ modifiers: ["cmd"], key: "l" }}
          />
          {latestChanges && (
            <Action.CopyToClipboard
              title="Copy Recent Changes"
              content={latestChanges}
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          )}
          {changelogBrowserUrl && (
            <Action.OpenInBrowser
              title="Open Changelog in Browser"
              url={changelogBrowserUrl}
              icon={Icon.Globe}
              shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
            />
          )}
        </ActionPanel.Section>
      )}

      <ActionPanel.Section>
        <Action.OpenInBrowser
          title="Open in Raycast Store"
          url={storeDeeplink}
          icon={Icon.RaycastLogoNeg}
          shortcut={Keyboard.Shortcut.Common.Open}
        />
        <Action.CopyToClipboard
          title="Copy Extension URL"
          content={item.url}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
        <Action.OpenInBrowser title="Open in Browser" url={item.url} icon={Icon.Globe} />
      </ActionPanel.Section>

      {item.prUrl && (
        <ActionPanel.Section>
          <Action.OpenInBrowser title="View Pull Request" url={item.prUrl} icon={Icon.Code} />
        </ActionPanel.Section>
      )}

      <ActionPanel.Section>
        <Action.OpenInBrowser title="View Author Profile" url={item.authorUrl} icon={Icon.Person} />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

function ExtensionItemDetail({ item }: { item: StoreItem }) {
  const storeDeeplink = createStoreDeeplink(item.url);
  const hasMac = item.platforms?.some((p) => p.toLowerCase() === "macos") ?? true;
  const hasWindows = item.platforms?.some((p) => p.toLowerCase() === "windows") ?? false;

  // No markdown area — keep sidebar compact with metadata only

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Description" text={item.summary} />

          <List.Item.Detail.Metadata.TagList title="Type">
            <List.Item.Detail.Metadata.TagList.Item
              text={item.type === "new" ? "New" : "Updated"}
              color={item.type === "new" ? Color.Green : Color.Blue}
            />
          </List.Item.Detail.Metadata.TagList>

          {item.version && <List.Item.Detail.Metadata.Label title="Version" text={item.version} />}

          <List.Item.Detail.Metadata.TagList title="Platforms">
            {hasMac && <List.Item.Detail.Metadata.TagList.Item text="macOS" color={Color.PrimaryText} />}
            {hasWindows && <List.Item.Detail.Metadata.TagList.Item text="Windows" color={Color.PrimaryText} />}
          </List.Item.Detail.Metadata.TagList>

          {item.categories && item.categories.length > 0 && (
            <List.Item.Detail.Metadata.TagList title="Categories">
              {item.categories.map((cat) => (
                <List.Item.Detail.Metadata.TagList.Item key={cat} text={cat} color={Color.SecondaryText} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          )}

          <List.Item.Detail.Metadata.Separator />

          <List.Item.Detail.Metadata.Link title="Author" text={item.authorName} target={item.authorUrl} />
          <List.Item.Detail.Metadata.Link title="Store" text="Open in Store" target={storeDeeplink} />

          {item.prUrl && <List.Item.Detail.Metadata.Link title="Pull Request" text={`View PR`} target={item.prUrl} />}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function ExtensionListItem({
  item,
  filter,
  platformFilter,
}: {
  item: StoreItem;
  filter: FilterValue;
  platformFilter: string;
}) {
  const showTypeTag = filter === "all";

  const accessories: List.Item.Accessory[] = [];

  // Show platform icons only when preference is set to "All Platforms"
  if (platformFilter === "all") {
    const hasMac = item.platforms?.some((p) => p.toLowerCase() === "macos") ?? true;
    const hasWindows = item.platforms?.some((p) => p.toLowerCase() === "windows") ?? false;
    if (hasMac) {
      accessories.push({ icon: { source: "platform-macos.svg" }, tooltip: "macOS" });
    }
    if (hasWindows) {
      accessories.push({ icon: { source: "platform-windows.svg" }, tooltip: "Windows" });
    }
  }

  if (showTypeTag) {
    accessories.push({
      icon: {
        source: item.type === "new" ? Icon.StarCircle : Icon.ArrowUpCircle,
        tintColor: item.type === "new" ? Color.Green : Color.Blue,
      },
      tooltip: item.type === "new" ? "New Extension" : "Updated Extension",
    });
  }

  return (
    <List.Item
      icon={{ source: item.image, fallback: Icon.Box }}
      title={item.title}
      accessories={accessories}
      detail={<ExtensionItemDetail item={item} />}
      actions={<ExtensionActions item={item} />}
    />
  );
}

// =============================================================================
// Command
// =============================================================================

export default function Command() {
  const { platformFilter } = getPreferenceValues<Preferences>();
  const [filter, setFilter] = useState<FilterValue>("all");

  const { data: feedData, isLoading: feedLoading } = useFetch<Feed>(FEED_URL, {
    keepPreviousData: true,
  });

  const { data: prsData, isLoading: prsLoading } = useFetch<GitHubPR[]>(GITHUB_PRS_URL, {
    keepPreviousData: true,
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  const isLoading = feedLoading || prsLoading;

  const [updatedItems, setUpdatedItems] = useState<StoreItem[]>([]);

  const [newItems, setNewItems] = useState<StoreItem[]>([]);

  // Build new items and fetch their platforms from package.json
  useEffect(() => {
    if (!feedData) return;
    const items = feedData.items ?? [];
    Promise.all(
      items.map(async (item) => {
        const { extension } = parseExtensionUrl(item.url);
        const pkgInfo = await fetchExtensionPackageInfo(extension);
        return {
          id: item.id,
          title: item.title,
          summary: item.summary,
          image: item.image,
          date: item.date_modified,
          authorName: item.author.name,
          authorUrl: item.author.url,
          url: item.url,
          type: "new" as const,
          extensionSlug: extension,
          platforms: pkgInfo?.platforms ?? ["macOS"],
          version: pkgInfo?.version,
          categories: pkgInfo?.categories,
        };
      }),
    ).then(setNewItems);
  }, [feedData]);

  // Fetch updated items from PRs (async because we need to fetch package.json for each)
  useEffect(() => {
    if (!prsData) return;
    const newSlugs = new Set(newItems.map((i) => i.extensionSlug).filter(Boolean));
    convertPRsToStoreItems(prsData, newSlugs as Set<string>).then(setUpdatedItems);
  }, [prsData, newItems]);

  const allItems = useMemo(() => {
    return [...newItems, ...updatedItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [newItems, updatedItems]);

  const displayItems = useMemo(() => {
    let items: StoreItem[];
    switch (filter) {
      case "new":
        items = newItems;
        break;
      case "updated":
        items = updatedItems;
        break;
      default:
        items = allItems;
    }

    // Apply platform preference filter
    if (platformFilter && platformFilter !== "all") {
      const targetPlatform = platformFilter === "windows" ? "windows" : "macos";
      items = items.filter(
        (item) => item.platforms?.some((p) => p.toLowerCase() === targetPlatform) ?? targetPlatform === "macos",
      );
    }

    return items;
  }, [filter, newItems, updatedItems, allItems, platformFilter]);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder={
        platformFilter === "macOS"
          ? "Search macOS extensions..."
          : platformFilter === "windows"
            ? "Search Windows extensions..."
            : "Search extensions..."
      }
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" storeValue onChange={(val) => setFilter(val as FilterValue)}>
          <List.Dropdown.Item title="Show All" value="all" />
          <List.Dropdown.Item title="New Only" value="new" />
          <List.Dropdown.Item title="Updated Only" value="updated" />
        </List.Dropdown>
      }
    >
      {displayItems.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No Extensions Found"
          description={filter === "all" ? "Unable to load the feed" : `No ${filter} extensions found`}
        />
      ) : (
        displayItems.map((item) => (
          <ExtensionListItem key={item.id} item={item} filter={filter} platformFilter={platformFilter} />
        ))
      )}
    </List>
  );
}
