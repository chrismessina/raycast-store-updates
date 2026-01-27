# Implementation TODO: Raycast Store Updates Command

## Phase 1: Setup Types and Constants
- [x] Add TypeScript interfaces for `FeedAuthor`, `FeedItem`, `Feed`
- [x] Add `FilterValue` type
- [x] Add `FEED_URL` constant
- [x] Update imports (React hooks, Raycast API components, @raycast/utils)

## Phase 2: Data Fetching and Helper Functions
- [x] Implement `useFetch` hook for feed data with caching
- [x] Add `isNewExtension()` helper function (24-hour heuristic)
- [x] Add filter state with `useState`
- [x] Add filtered items computation with `useMemo`

## Phase 3: List UI with Search and Filtering
- [x] Replace placeholder List with searchable List
- [x] Add `List.Dropdown` for All/New/Updated filtering
- [x] Enable `isShowingDetail` for sidebar view
- [x] Add empty state handling for errors and no results

## Phase 4: ExtensionListItem Component
- [x] Create `ExtensionListItem` component
- [x] Add list item with title, subtitle (author), icon
- [x] Add accessories (New/Updated tag, modification date)
- [x] Add `List.Item.Detail` with markdown and metadata

## Phase 5: Actions and Deeplinks
- [x] Create `ExtensionActions` component
- [x] Parse author/extension from URL for deeplink
- [x] Add "Open in Raycast Store" action with deeplink
- [x] Add "View on Web" action
- [x] Add "View Author Profile" action
- [x] Add "Copy Extension URL" action

## Phase 6: Final Polish and Cleanup
- [x] Remove PLAN.md (implementation complete)
- [x] Test all filters (All, New, Updated)
- [x] Test deeplink opens Raycast Store
- [x] Final code review and cleanup
