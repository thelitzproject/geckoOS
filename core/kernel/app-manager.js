/**
 * App manager — registry, lifecycle, and sandboxed launch.
 */

// Built-in app manifests (id, module path, metadata)
const BUILTIN_APPS = [
  {
    id: 'terminal',
    name: 'Terminal',
    icon: 'assets/icons/apps/terminal.svg',
    module: '../../apps/terminal/index.js',
    category: 'utilities',
    keywords: ['shell', 'bash', 'command', 'cli', 'gsl'],
    defaultSize: { width: 720, height: 480 },
    allowMultiple: true,
  },
  {
    id: 'finder',
    name: 'Finder',
    icon: 'assets/icons/apps/finder.svg',
    module: '../../apps/finder/index.js',
    category: 'utilities',
    keywords: ['files', 'filesystem', 'browser', 'documents'],
    defaultSize: { width: 800, height: 520 },
    allowMultiple: false,
  },
  {
    id: 'textpad',
    name: 'TextPad',
    icon: 'assets/icons/apps/textpad.svg',
    module: '../../apps/textpad/index.js',
    category: 'productivity',
    keywords: ['text', 'editor', 'note', 'write'],
    defaultSize: { width: 640, height: 480 },
    allowMultiple: true,
  },
  {
    id: 'settings',
    name: 'System Settings',
    icon: 'assets/icons/apps/settings.svg',
    module: '../../apps/settings/index.js',
    category: 'system',
    keywords: ['preferences', 'config', 'options', 'settings'],
    defaultSize: { width: 740, height: 520 },
    allowMultiple: false,
  },
  {
    id: 'app-store',
    name: 'Gecko App Store',
    icon: 'assets/icons/apps/app-store.svg',
    module: '../../apps/app-store/index.js',
    category: 'system',
    keywords: ['install', 'download', 'apps', 'store'],
    defaultSize: { width: 860, height: 580 },
    allowMultiple: false,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: 'assets/icons/apps/calculator.svg',
    module: '../../apps/calculator/index.js',
    category: 'utilities',
    keywords: ['math', 'calc', 'numbers'],
    defaultSize: { width: 280, height: 380 },
    resizable: false,
    allowMultiple: false,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: 'assets/icons/apps/calendar.svg',
    module: '../../apps/calendar/index.js',
    category: 'productivity',
    keywords: ['date', 'time', 'events', 'schedule'],
    defaultSize: { width: 760, height: 520 },
    allowMultiple: false,
  },
  {
    id: 'browser',
    name: 'Browser',
    icon: 'assets/icons/apps/browser.svg',
    module: '../../apps/browser/index.js',
    category: 'internet',
    keywords: ['browser', 'web', 'internet', 'tabs', 'http', 'url'],
    defaultSize: { width: 1100, height: 700 },
    allowMultiple: true,
    menus: [
      {
        label: 'File',
        items: [
          { label: 'New Tab',    shortcut: '⌘T' },
          { label: 'New Window', shortcut: '⌘N' },
          { separator: true },
          { label: 'Close Tab',  shortcut: '⌘W' },
        ],
      },
      {
        label: 'View',
        items: [
          { label: 'Reload',     shortcut: '⌘R' },
          { label: 'Find…',      shortcut: '⌘F' },
          { separator: true },
          { label: 'Zoom In',    shortcut: '⌘+' },
          { label: 'Zoom Out',   shortcut: '⌘-' },
          { label: 'Reset Zoom', shortcut: '⌘0' },
        ],
      },
      {
        label: 'History',
        items: [
          { label: 'Show History',    shortcut: '⌘Y' },
          { label: 'Show Bookmarks',  shortcut: '⌘B' },
        ],
      },
    ],
  },
  {
    id: 'snake',
    name: 'Snake',
    icon: 'assets/icons/apps/snake.svg',
    module: '../../apps/snake/index.js',
    category: 'games',
    keywords: ['snake', 'game', 'arcade'],
    defaultSize: { width: 460, height: 520 },
    resizable: false,
    allowMultiple: false,
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    icon: 'assets/icons/apps/minesweeper.svg',
    module: '../../apps/minesweeper/index.js',
    category: 'games',
    keywords: ['minesweeper', 'mines', 'puzzle', 'game'],
    defaultSize: { width: 420, height: 520 },
    resizable: false,
    allowMultiple: false,
  },
  {
    id: 'breakout',
    name: 'Breakout',
    icon: 'assets/icons/apps/breakout.svg',
    module: '../../apps/breakout/index.js',
    category: 'games',
    keywords: ['breakout', 'bricks', 'arcade', 'game', 'paddle'],
    defaultSize: { width: 520, height: 520 },
    resizable: false,
    allowMultiple: false,
  },
  {
    id: 'about',
    name: 'About geckoOS',
    icon: 'assets/icons/apps/about.svg',
    module: '../../apps/about/index.js',
    category: 'system',
    keywords: ['about', 'version', 'info', 'system', 'gsl', 'storage', 'license'],
    defaultSize: { width: 520, height: 560 },
    resizable: false,
    allowMultiple: false,
  },
];

// Third-party apps installed via the App Store (stored in IndexedDB)
const INSTALLED_KEY = 'geckoOS.installedApps';

export class AppManager {
  #kernel;
  #registry = new Map();      // id → manifest
  #instances = new Map();     // instanceId → { manifest, window }
  #modules = new Map();       // id → loaded module
  #nextInstanceId = 1;

  constructor(kernel) {
    this.#kernel = kernel;
  }

  async load() {
    // Register built-ins
    for (const manifest of BUILTIN_APPS) {
      this.#registry.set(manifest.id, manifest);
    }

    // Load third-party installed apps
    try {
      const raw = localStorage.getItem(INSTALLED_KEY);
      if (raw) {
        const installed = JSON.parse(raw);
        for (const manifest of installed) {
          this.#registry.set(manifest.id, { ...manifest, thirdParty: true });
        }
      }
    } catch {}
  }

  all() {
    return Array.from(this.#registry.values());
  }

  get(id) {
    return this.#registry.get(id) ?? null;
  }

  search(query) {
    const q = query.toLowerCase();
    return this.all().filter(app =>
      app.name.toLowerCase().includes(q) ||
      app.keywords?.some(k => k.includes(q))
    );
  }

  async launch(id, args = {}) {
    const manifest = this.#registry.get(id);
    if (!manifest) throw new Error(`Unknown app: ${id}`);

    // Enforce single-instance apps
    if (!manifest.allowMultiple) {
      const existing = this._findInstance(id);
      if (existing) {
        this.#kernel.wm.focus(existing.windowId);
        return existing;
      }
    }

    const instanceId = this.#nextInstanceId++;
    this.#kernel.events.emit('app:launching', { id, instanceId });

    // Animate dock icon
    this.#kernel.dock.bounce(id);

    // Load module on demand
    let mod = this.#modules.get(id);
    if (!mod) {
      mod = await import(manifest.module);
      this.#modules.set(id, mod);
    }

    // Create window
    const win = this.#kernel.wm.create({
      title: manifest.name,
      icon: manifest.icon,
      width: manifest.defaultSize?.width ?? 800,
      height: manifest.defaultSize?.height ?? 600,
      resizable: manifest.resizable ?? true,
      appId: id,
    });

    // Instantiate app
    const app = new mod.default(this.#kernel, win, args);
    await app.mount(win.content);

    const instance = { id, instanceId, manifest, windowId: win.id, app, window: win };
    this.#instances.set(instanceId, instance);

    win.onClose(() => this._destroyInstance(instanceId));

    this.#kernel.events.emit('app:launched', { id, instanceId });
    this.#kernel.dock.setRunning(id, true);

    return instance;
  }

  _findInstance(appId) {
    for (const inst of this.#instances.values()) {
      if (inst.id === appId) return inst;
    }
    return null;
  }

  _destroyInstance(instanceId) {
    const inst = this.#instances.get(instanceId);
    if (!inst) return;

    inst.app?.destroy?.();
    this.#instances.delete(instanceId);

    // Turn off running dot if no more instances
    const stillRunning = Array.from(this.#instances.values()).some(i => i.id === inst.id);
    if (!stillRunning) this.#kernel.dock.setRunning(inst.id, false);

    this.#kernel.events.emit('app:closed', { id: inst.id, instanceId });
  }

  install(manifest) {
    this.#registry.set(manifest.id, { ...manifest, thirdParty: true });
    this._persistInstalled();
    this.#kernel.events.emit('app:installed', manifest);
  }

  uninstall(id) {
    const m = this.#registry.get(id);
    if (!m?.thirdParty) return;
    this.#registry.delete(id);
    this._persistInstalled();
    this.#kernel.events.emit('app:uninstalled', { id });
  }

  _persistInstalled() {
    const installed = this.all().filter(a => a.thirdParty);
    localStorage.setItem(INSTALLED_KEY, JSON.stringify(installed));
  }
}
