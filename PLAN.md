# Implementation Plan: Raycast Store Updates Command

## Overview

This plan details the implementation of the "View Store Updates" command that fetches the Raycast Store JSON feed, renders a searchable list with New/Updated filtering, shows detail sidebar info, and opens extensions in the Raycast Store via deeplinks.

---

## 1. Data Types & Interfaces

**Location:** `src/view-store-updates.tsx` (top of file, after imports)

Define TypeScript interfaces to model the JSON Feed schema:

```typescript
interface FeedAuthor {
  name: string;
  url: string;
}

interface FeedItem {
  id: string;           // Extension URL (e.g., "https://www.raycast.com/author/extension")
  url: string;          // Same as id
  title: string;        // Extension name
  summary: string;      // Extension description
  image: string;        // Extension icon URL
  date_modified: string; // ISO 8601 timestamp
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
```

---

## 2. Feed URL Constant

**Location:** `src/view-store-updates.tsx` (after interfaces)

```typescript
const FEED_URL = "https://chrismessina.github.io/raycast-store-updates/feed.json";
```

---

## 3. Data Fetching with `useFetch`

**Location:** `src/view-store-updates.tsx` (inside Command component)

Use the `useFetch` hook from `@raycast/utils` for automatic caching and stale-while-revalidate behavior:

```typescript
import { useFetch } from "@raycast/utils";

// Inside Command:
const { data, isLoading, error } = useFetch<Feed>(FEED_URL, {
  keepPreviousData: true, // Prevents flickering when filter changes
});
```

**Imports to add:**
```typescript
import { useFetch } from "@raycast/utils";
```

The `useFetch` hook provides:
- Built-in caching (persists between command runs)
- Automatic error handling with toast
- `stale-while-revalidate` behavior
- No manual `parseResponse` needed for JSON (uses `.json()` by default)

---

## 4. Filter State Management

**Location:** `src/view-store-updates.tsx` (inside Command component)

Use React `useState` to track the selected filter dropdown value:

```typescript
import { useState } from "react";

type FilterValue = "all" | "new" | "updated";

// Inside Command:
const [filter, setFilter] = useState<FilterValue>("all");
```

---

## 5. New vs Updated Classification Logic

**Location:** `src/view-store-updates.tsx` (helper function before Command)

Since the feed only provides `date_modified`, we need a heuristic to distinguish "new" from "updated" extensions:

**Heuristic:** Extensions modified within the last 24 hours are considered "new" if they were added recently to the feed. Since we don't have a `date_published` field, we'll treat extensions whose `date_modified` is within 7 days as potentially "new" (recently added) and older modifications as "updated".

A simpler approach: treat all items as "updates" since the feed shows the latest modifications. However, to provide value for the "New" filter, we can:

**Recommended Approach:** Use a time-based heuristic:
- "New": `date_modified` within the last 24 hours
- "Updated": `date_modified` older than 24 hours (but still in the feed = recent activity)

```typescript
function isNewExtension(dateModified: string): boolean {
  const modified = new Date(dateModified);
  const now = new Date();
  const hoursDiff = (now.getTime() - modified.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 24;
}
```

---

## 6. Filtered Items Computation

**Location:** `src/view-store-updates.tsx` (inside Command, after hooks)

```typescript
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
```

**Import to add:**
```typescript
import { useMemo } from "react";
```

---

## 7. List Component with Search & Filtering

**Location:** `src/view-store-updates.tsx` (Command return JSX)

Replace the placeholder `List` with:

```tsx
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
      <List.Dropdown.Item title="New" value="new" />
      <List.Dropdown.Item title="Updated" value="updated" />
    </List.Dropdown>
  }
>
  {filteredItems.map((item) => (
    <ExtensionListItem key={item.id} item={item} />
  ))}
</List>
```

**Key props:**
- `isShowingDetail`: Enables the detail sidebar
- `searchBarPlaceholder`: Search hint text
- `searchBarAccessory`: Dropdown for New/Updated filtering

---

## 8. List Item Component with Detail Sidebar

**Location:** `src/view-store-updates.tsx` (separate component before Command)

Create a dedicated component for rendering each extension:

```tsx
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
              <List.Item.Detail.Metadata.Link
                title="Author"
                text={item.author.name}
                target={item.author.url}
              />
              <List.Item.Detail.Metadata.Label
                title="Last Updated"
                text={modifiedDate.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
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
```

**Imports to add:**
```typescript
import { Icon, Color } from "@raycast/api";
```

---

## 9. Actions Component with Deeplink

**Location:** `src/view-store-updates.tsx` (separate component)

Create an actions component that opens the extension in the Raycast Store:

```tsx
function ExtensionActions({ item }: { item: FeedItem }) {
  // Parse author and extension name from URL
  // URL format: https://www.raycast.com/{author}/{extension}
  const urlParts = item.url.replace("https://www.raycast.com/", "").split("/");
  const authorName = urlParts[0];
  const extensionName = urlParts[1];

  // Deeplink to open the extension in Raycast Store
  // Format: raycast://extensions/{author}/{extension}
  const storeDeeplink = `raycast://extensions/${authorName}/${extensionName}`;

  return (
    <ActionPanel>
      <ActionPanel.Section>
        <Action.OpenInBrowser
          title="Open in Raycast Store"
          url={storeDeeplink}
          icon={Icon.RaycastLogoNeg}
        />
        <Action.OpenInBrowser
          title="View on Web"
          url={item.url}
          icon={Icon.Globe}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.OpenInBrowser
          title="View Author Profile"
          url={item.author.url}
          icon={Icon.Person}
        />
        <Action.CopyToClipboard
          title="Copy Extension URL"
          content={item.url}
          shortcut={{ modifiers: ["cmd"], key: "c" }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
```

**Note on Deeplink Behavior:**
- `raycast://extensions/{author}/{extension}` will open the extension's store page if installed, or show the install prompt
- Using `Action.OpenInBrowser` for deeplinks works because Raycast registers the `raycast://` URL scheme

---

## 10. Error Handling

**Location:** `src/view-store-updates.tsx` (in Command component)

The `useFetch` hook handles errors automatically by showing a toast. Optionally, display an empty state:

```tsx
// After hooks, before return:
if (error) {
  return (
    <List>
      <List.EmptyView
        title="Failed to Load Feed"
        description="Check your internet connection and try again."
        icon={Icon.XMarkCircle}
      />
    </List>
  );
}
```

---

## 11. Empty State for No Results

**Location:** `src/view-store-updates.tsx` (inside List component)

Add an empty view when filtering returns no results:

```tsx
<List
  // ... existing props
>
  {filteredItems.length === 0 && !isLoading ? (
    <List.EmptyView
      title={`No ${filter === "all" ? "" : filter} Extensions Found`}
      description={filter !== "all" ? "Try changing the filter" : "No extensions in the feed"}
      icon={Icon.MagnifyingGlass}
    />
  ) : (
    filteredItems.map((item) => (
      <ExtensionListItem key={item.id} item={item} />
    ))
  )}
</List>
```

---

## 12. Complete Imports

**Location:** `src/view-store-updates.tsx` (top of file)

```typescript
import { useState, useMemo } from "react";
import { ActionPanel, Action, List, Icon, Color } from "@raycast/api";
import { useFetch } from "@raycast/utils";
```

---

## 13. File Structure Summary

The final file structure for `src/view-store-updates.tsx`:

```
1. Imports (React, Raycast API, @raycast/utils)
2. Type definitions (FeedAuthor, FeedItem, Feed, FilterValue)
3. Constants (FEED_URL)
4. Helper functions (isNewExtension)
5. ExtensionActions component
6. ExtensionListItem component
7. Command component (default export)
```

---

## Architecture Decisions

### Caching Strategy
Using `useFetch` with default caching provides:
- Automatic stale-while-revalidate behavior
- Data persists between command invocations
- No additional cache configuration needed

### New vs Updated Heuristic
Using a 24-hour threshold for "new" extensions is a reasonable default since:
- The feed shows recently modified extensions
- Without a `date_published` field, we can't definitively know when an extension was first added
- Users can still see all items and the modification date in the detail view

### Deeplink Format
The deeplink `raycast://extensions/{author}/{extension}` will:
- Open the extension in Raycast if installed
- Show the store page/install prompt if not installed
- This is the standard Raycast cross-extension navigation pattern

### Detail Sidebar
Using `isShowingDetail` with `List.Item.Detail` provides:
- Rich metadata display without navigation
- Markdown rendering for the extension icon and description
- Structured metadata section for author, date, and status

---

## Dependencies

No new dependencies required. The implementation uses:
- `@raycast/api` (already in package.json)
- `@raycast/utils` (already in package.json)
