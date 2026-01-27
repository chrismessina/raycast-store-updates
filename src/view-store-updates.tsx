import { useState, useMemo } from "react";
import { ActionPanel, Action, List, Icon, Color } from "@raycast/api";
import { useFetch } from "@raycast/utils";

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

type FilterValue = "all" | "new" | "updated";

// =============================================================================
// Constants
// =============================================================================

const FEED_URL = "https://chrismessina.github.io/raycast-store-updates/feed.json";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines if an extension is "new" based on modification date.
 * Extensions modified within the last 24 hours are considered "new".
 */
function isNewExtension(dateModified: string): boolean {
  const modified = new Date(dateModified);
  const now = new Date();
  const hoursDiff = (now.getTime() - modified.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 24;
}

/**
 * Formats a date for display in the detail metadata.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

// =============================================================================
// Components
// =============================================================================

function ExtensionActions({ item }: { item: FeedItem }) {
  const storeDeeplink = createStoreDeeplink(item.url);

  return (
    <ActionPanel>
      <ActionPanel.Section>
        <Action.OpenInBrowser title="Open in Raycast Store" url={storeDeeplink} icon={Icon.RaycastLogoNeg} />
        <Action.OpenInBrowser title="View on Web" url={item.url} icon={Icon.Globe} />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.OpenInBrowser title="View Author Profile" url={item.author.url} icon={Icon.Person} />
        <Action.CopyToClipboard
          title="Copy Extension URL"
          content={item.url}
          shortcut={{ modifiers: ["cmd"], key: "c" }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

function ExtensionListItem({ item }: { item: FeedItem }) {
  const modifiedDate = new Date(item.date_modified);
  const isNew = isNewExtension(item.date_modified);

  return (
    <List.Item
      title={item.title}
      subtitle={item.author.name}
      icon={{ source: item.image, fallback: Icon.Box }}
      accessories={[
        {
          tag: {
            value: isNew ? "New" : "Updated",
            color: isNew ? Color.Green : Color.Blue,
          },
        },
        {
          date: modifiedDate,
          tooltip: `Modified: ${modifiedDate.toLocaleString()}`,
        },
      ]}
      detail={
        <List.Item.Detail
          markdown={`![Extension Icon](${item.image})\n\n${item.summary}`}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Title" text={item.title} />
              <List.Item.Detail.Metadata.Label title="Description" text={item.summary} />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Link title="Author" text={item.author.name} target={item.author.url} />
              <List.Item.Detail.Metadata.Label title="Last Updated" text={formatDate(item.date_modified)} />
              <List.Item.Detail.Metadata.TagList title="Status">
                <List.Item.Detail.Metadata.TagList.Item
                  text={isNew ? "New" : "Updated"}
                  color={isNew ? Color.Green : Color.Blue}
                />
              </List.Item.Detail.Metadata.TagList>
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={<ExtensionActions item={item} />}
    />
  );
}

// =============================================================================
// Command
// =============================================================================

export default function Command() {
  // Fetch feed data with caching (stale-while-revalidate)
  const { data, isLoading } = useFetch<Feed>(FEED_URL, {
    keepPreviousData: true,
  });

  // Filter state
  const [filter, setFilter] = useState<FilterValue>("all");

  // Compute filtered items based on selected filter
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    switch (filter) {
      case "new":
        return data.items.filter((item) => isNewExtension(item.date_modified));
      case "updated":
        return data.items.filter((item) => !isNewExtension(item.date_modified));
      case "all":
      default:
        return data.items;
    }
  }, [data?.items, filter]);

  // Determine empty state message based on filter
  const getEmptyViewProps = () => {
    if (filter === "new") {
      return {
        title: "No New Extensions",
        description: "No extensions have been added in the last 24 hours",
      };
    }
    if (filter === "updated") {
      return {
        title: "No Updated Extensions",
        description: "No extensions have been updated recently",
      };
    }
    return {
      title: "No Extensions Found",
      description: "Unable to load the feed",
    };
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search extensions..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Type"
          value={filter}
          onChange={(newValue) => setFilter(newValue as FilterValue)}
        >
          <List.Dropdown.Item title="All" value="all" />
          <List.Dropdown.Item title="New (Last 24h)" value="new" />
          <List.Dropdown.Item title="Updated" value="updated" />
        </List.Dropdown>
      }
    >
      {filteredItems.length === 0 && !isLoading ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} {...getEmptyViewProps()} />
      ) : (
        filteredItems.map((item) => <ExtensionListItem key={item.id} item={item} />)
      )}
    </List>
  );
}
