# Contributing

Issues and PRs are welcome.

**Setup:** `npx serve . --port 3000` — no build step needed.

**Tests:** `npm test` (unit) · `npm run test:e2e` (Playwright, requires `npm run dev` running)

**Code style:** 2-space indent, ES modules, no framework. Run `npm run lint` before opening a PR.

**New app?** Extend `GeckoApp` from `sdk/api/gecko-sdk.js` and register in `core/kernel/app-manager.js`.
