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
// Command
// =============================================================================

export default function Command() {
  return (
    <List>
      <List.Item
        icon={Icon.Bird}
        title="Greeting"
        actions={
          <ActionPanel>
            <Action.OpenInBrowser title="Open Raycast" url="https://raycast.com" />
          </ActionPanel>
        }
      />
    </List>
  );
}
