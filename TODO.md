# Implementation TODO: Raycast Store Updates Command

## Phase 1: Setup Types and Constants
- [x] Add TypeScript interfaces for `FeedAuthor`, `FeedItem`, `Feed`
- [x] Add `FilterValue` type
- [x] Add `FEED_URL` constant
- [x] Update imports (React hooks, Raycast API components, @raycast/utils)

## Phase 2: Data Fetching and Helper Functions
- [ ] Implement `useFetch` hook for feed data with caching
- [ ] Add `isNewExtension()` helper function (24-hour heuristic)
- [ ] Add filter state with `useState`
- [ ] Add filtered items computation with `useMemo`

## Phase 3: List UI with Search and Filtering
- [ ] Replace placeholder List with searchable List
- [ ] Add `List.Dropdown` for All/New/Updated filtering
- [ ] Enable `isShowingDetail` for sidebar view
- [ ] Add empty state handling for errors and no results

## Phase 4: ExtensionListItem Component
- [ ] Create `ExtensionListItem` component
- [ ] Add list item with title, subtitle (author), icon
- [ ] Add accessories (New/Updated tag, modification date)
- [ ] Add `List.Item.Detail` with markdown and metadata

## Phase 5: Actions and Deeplinks
- [ ] Create `ExtensionActions` component
- [ ] Parse author/extension from URL for deeplink
- [ ] Add "Open in Raycast Store" action with deeplink
- [ ] Add "View on Web" action
- [ ] Add "View Author Profile" action
- [ ] Add "Copy Extension URL" action

## Phase 6: Final Polish and Cleanup
- [ ] Remove PLAN.md (implementation complete)
- [ ] Test all filters (All, New, Updated)
- [ ] Test deeplink opens Raycast Store
- [ ] Final code review and cleanup
