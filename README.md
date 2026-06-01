# geckoOS

<div align="center">
  <img src="assets/icons/system/gecko-mark.svg" width="120" alt="geckoOS" />
</div>

> A browser-based desktop OS with a Mac-style UI and Gecko Subsystem for Linux.

**geckoOS** runs entirely in your browser — no install, no backend. It ships a full Mac-style desktop with a window manager, dock, menu bar, Spotlight search, and a built-in Linux environment (GSL) powered by a virtual filesystem and bash-compatible shell.

---

## Features

- **Mac-style desktop** — menu bar, dock with magnification, draggable/resizable windows with traffic-light buttons
- **GSL (Gecko Subsystem for Linux)** — virtual filesystem (IndexedDB), bash-compatible shell, process manager, APT package manager, and `curl`/`wget`
- **Litzium Browser** — full tabbed browser with omnibox suggestions, bookmarks, history, find-in-page, and `litz://` internal pages
- **Built-in apps** — Terminal, Finder, TextPad, Settings, App Store, Calculator, Calendar, About
- **Spotlight search** — `Ctrl+Space` to search apps and files
- **Light & dark themes** with accent color picker
- **PWA** — installable, works offline via service worker

## Quick start

```bash
# No build step needed — just serve the directory
npx serve . --port 3000
# or
npm run dev
```

Open `http://localhost:3000`.

## Stack

Vanilla JS (ES modules) · HTML · CSS · IndexedDB · No framework · No bundler required