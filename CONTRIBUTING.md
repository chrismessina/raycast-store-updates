# Contributing to Raycast Store Updates

Thanks for helping. This guide covers running Raycast Store Updates locally and sending a change.

## Where changes go

Raycast Store Updates is published in the [Raycast Store](https://www.raycast.com/chrismessina/raycast-store-updates).
Open pull requests against [`raycast/extensions`](https://github.com/raycast/extensions/tree/main/extensions/raycast-store-updates),
not this repository: Raycast reviews every change there, and merged changes come back here in a
sync pull request. Open [issues](https://github.com/chrismessina/raycast-store-updates/issues) here or in
`raycast/extensions`, whichever you prefer.

## Run it locally

You need [Raycast](https://www.raycast.com/) and Node.js 22.22.2 or later.

1. In Raycast, find Raycast Store Updates in the Store and choose **Fork Extension** from the action panel.
   Raycast checks out only this extension's folder from `raycast/extensions`.
2. In that folder, run `npm ci`, then `npm run dev`. Raycast opens the development version, and
   saving a file reloads it.

Without a token, the development build shares GitHub's anonymous budget of 60 requests per hour,
which a few reloads can use up. Set the **GitHub Token** preference to a classic token with no
scopes to raise the budget to 5,000. `docs/api-cost.md` explains where the requests go.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run the extension in Raycast and reload on save |
| `npm run build` | Build the distribution bundle |
| `npm run lint` | Run Raycast's ESLint and Prettier checks |
| `npm run fix-lint` | Fix what the linter can fix |
| `npm test` | Run the unit tests (Vitest, in `test/`) |
| `npm run publish` | Open or update the pull request in `raycast/extensions` (`ray publish`) |
| `prepublishOnly` | Stops `npm publish`: the extension goes to the Raycast Store, never to the npm registry |

## How it works

```
src/
├── view-store-updates.tsx      # The main list command
├── store-updates-menu-bar.tsx  # The menu-bar badge
├── tools/                      # The Find Store Updates AI tool
├── components/                 # List items, detail panes, action panels
├── hooks/                      # Read state, filter toggles, changelog, rate limit
├── types/                      # The unified StoreItem shape
└── utils/                      # Fetching, slug resolution, caching, GraphQL
assets/                         # Extension and platform icons
metadata/                       # Store screenshots
media/                          # README images
docs/                           # API cost notes
test/                           # Unit tests
```

- New extensions come from the Store's JSON feed, `https://www.raycast.com/store/feed.json`.
  Updates and removals come from recently merged pull requests in `raycast/extensions`, through
  the GitHub REST API, or GraphQL (`src/utils/graphql.ts`) when the GraphQL preference is on and a
  token is set. `src/utils/index.ts` turns both into one list of `StoreItem`s and resolves each
  pull request to an extension slug.
- `src/utils/store-cache.ts` keeps the last list and the last-seen time that the menu bar uses for
  its unseen count.
- My Updates reads the extensions installed in your local Raycast
  (`fetchInstalledExtensionSlugs()` in `src/utils/index.ts`). When that read cannot be trusted it
  returns `null` rather than an empty set, so a failed read never looks like "no updates".
- `src/tools/find-store-updates.ts` is the Ask AI tool. Its instructions and evals are in `ai.yaml`.

## Before you open a pull request

- `npm run build`, `npx tsc --noEmit`, `npm run lint` and `npm test` all pass, and so does
  `npx ray evals --non-interactive --exit-on-error`.
- You tried the commands and the Ask AI tool in Raycast, including their error and empty states.
- `CHANGELOG.md` has a new entry at the top, dated `{PR_MERGE_DATE}`. Raycast fills in the date
  when the pull request merges.
- New or changed screenshots go in `metadata/`, taken with Raycast's Window Capture.
