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
        filteredItems.map((item) => (
          <List.Item
            key={item.id}
            icon={{ source: item.image, fallback: Icon.Box }}
            title={item.title}
            subtitle={item.author.name}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser title="View on Web" url={item.url} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
