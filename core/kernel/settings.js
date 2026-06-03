const STORAGE_KEY = 'geckoOS.settings';

const DEFAULTS = {
  // Appearance
  'appearance.theme':              'light',
  'appearance.accentColor':        '#007aff',
  'appearance.fontSize':           13,
  'appearance.fontFamily':         'system-ui',
  'appearance.windowAnimations':   true,

  // Desktop
  'desktop.wallpaper':             'assets/wallpapers/default.jpg',
  'desktop.showIcons':             true,
  'desktop.iconSize':              48,
  'desktop.showIconLabels':        true,

  // Dock
  'dock.position':                 'bottom',
  'dock.autohide':                 false,
  'dock.magnification':            true,
  'dock.showDot':                  true,
  'dock.iconSize':                 52,

  // Menu Bar
  'menubar.clock24h':              false,
  'menubar.showDate':              false,
  'menubar.showSeconds':           false,
  'menubar.showBattery':           true,
  'menubar.showNetwork':           true,
  'menubar.showBluetooth':         false,

  // Notifications
  'notifications.enabled':         true,
  'notifications.sound':           false,
  'notifications.dnd':             false,
  'notifications.duration':        '4000',

  // Accessibility
  'accessibility.reduceMotion':    false,
  'accessibility.highContrast':    false,
  'accessibility.boldText':        false,
  'accessibility.reduceTransparency': false,
  'accessibility.keyboardNav':     false,
  'accessibility.stickyKeys':      false,
  'accessibility.cursorSize':      1,

  // General
  'general.language':              'en-US',
  'general.autosave':              true,
  'general.bootSplash':            true,

  // GSL
  'gsl.enabled':                   true,

  // System
  'startup.apps':                  [],
  'oobe.completed':                false,
  'user.name':                     '',
};

export class Settings {
  #data = {};
  #kernel;

  constructor(kernel) {
    this.#kernel = kernel;
  }

  async load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.#data = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      this.#data = { ...DEFAULTS };
    }
  }

  get(key, fallback) {
    return key in this.#data ? this.#data[key] : (fallback ?? DEFAULTS[key]);
  }

  set(key, value) {
    this.#data[key] = value;
    this._persist();
    this.#kernel.events.emit('settings:changed', { key, value });
    this.apply();
  }

  setMany(patch) {
    Object.assign(this.#data, patch);
    this._persist();
    this.#kernel.events.emit('settings:changed', { patch });
    this.apply();
  }

  reset(key) {
    if (key) {
      this.#data[key] = DEFAULTS[key];
    } else {
      this.#data = { ...DEFAULTS };
    }
    this._persist();
    this.apply();
  }

  apply() {
    const root = document.documentElement;

    // ── Theme ──────────────────────────────────────────────────────────────
    const theme = this.get('appearance.theme');
    root.setAttribute('data-theme', theme);

    // ── Accent color ───────────────────────────────────────────────────────
    const accent = this.get('appearance.accentColor');
    root.style.setProperty('--color-accent', accent);

    // ── Font size ──────────────────────────────────────────────────────────
    const fontSize = this.get('appearance.fontSize', 13);
    root.style.setProperty('--font-size-base', `${fontSize}px`);
    root.style.setProperty('--font-size-sm',   `${fontSize - 2}px`);
    root.style.setProperty('--font-size-md',   `${fontSize}px`);
    root.style.setProperty('--font-size-lg',   `${fontSize + 2}px`);
    root.style.setProperty('--font-size-xl',   `${fontSize + 4}px`);

    // ── Font family ────────────────────────────────────────────────────────
    const fontFamily = this.get('appearance.fontFamily', 'system-ui');
    root.style.setProperty('--font-system', fontFamily);

    // ── Window animations ──────────────────────────────────────────────────
    root.classList.toggle('no-window-animations', !this.get('appearance.windowAnimations', true));

    // ── Wallpaper ──────────────────────────────────────────────────────────
    const wallpaper = this.get('desktop.wallpaper', '');
    const surface = document.getElementById('desktop-surface');
    if (surface) {
      if (wallpaper.startsWith('gradient:')) {
        surface.style.backgroundImage = wallpaper.slice('gradient:'.length);
      } else if (wallpaper) {
        surface.style.backgroundImage = `url(${wallpaper})`;
      } else {
        surface.style.backgroundImage = '';
      }
    }

    // ── Desktop icons visibility ───────────────────────────────────────────
    const showIcons = this.get('desktop.showIcons', true);
    document.querySelectorAll('.desktop-icon').forEach(el => {
      el.style.display = showIcons ? '' : 'none';
    });

    // ── Desktop icon size ──────────────────────────────────────────────────
    const iconSz = this.get('desktop.iconSize', 48);
    document.querySelectorAll('.desktop-icon-img').forEach(img => {
      img.style.width  = `${iconSz}px`;
      img.style.height = `${iconSz}px`;
    });

    // ── Desktop icon labels ────────────────────────────────────────────────
    const showLabels = this.get('desktop.showIconLabels', true);
    document.querySelectorAll('.desktop-icon-label').forEach(el => {
      el.style.display = showLabels ? '' : 'none';
    });

    // ── Dock icon size ─────────────────────────────────────────────────────
    const dockSz = this.get('dock.iconSize', 52);
    root.style.setProperty('--dock-icon-size', `${dockSz}px`);

    // ── Dock magnification ─────────────────────────────────────────────────
    root.classList.toggle('no-dock-magnification', !this.get('dock.magnification', true));

    // ── Dock running dot ───────────────────────────────────────────────────
    root.classList.toggle('hide-dock-dot', !this.get('dock.showDot', true));

    // ── Menubar indicators ─────────────────────────────────────────────────
    const wifiEl = document.getElementById('wifi-indicator');
    if (wifiEl) wifiEl.style.display = this.get('menubar.showNetwork', true) ? '' : 'none';

    const battEl = document.getElementById('battery-indicator');
    if (battEl) battEl.style.display = this.get('menubar.showBattery', true) ? '' : 'none';

    const btEl = document.getElementById('bluetooth-indicator');
    if (btEl) btEl.style.display = this.get('menubar.showBluetooth', false) ? '' : 'none';

    // ── Accessibility ──────────────────────────────────────────────────────
    const reduceMotion = this.get('accessibility.reduceMotion', false);
    if (reduceMotion) {
      root.style.setProperty('--transition-fast',   '0ms');
      root.style.setProperty('--transition-base',   '0ms');
      root.style.setProperty('--transition-slow',   '0ms');
      root.style.setProperty('--transition-spring', '0ms');
    } else {
      root.style.removeProperty('--transition-fast');
      root.style.removeProperty('--transition-base');
      root.style.removeProperty('--transition-slow');
      root.style.removeProperty('--transition-spring');
    }

    root.classList.toggle('high-contrast',        this.get('accessibility.highContrast', false));
    root.classList.toggle('bold-text',             this.get('accessibility.boldText', false));
    root.classList.toggle('reduce-transparency',   this.get('accessibility.reduceTransparency', false));
    root.classList.toggle('keyboard-nav',          this.get('accessibility.keyboardNav', false));

    // Cursor size — scale via CSS
    const cursorScale = this.get('accessibility.cursorSize', 1);
    root.style.setProperty('--cursor-scale', String(cursorScale));
    if (cursorScale !== 1) {
      document.body.style.cursor = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${Math.round(16 * cursorScale)}' height='${Math.round(24 * cursorScale)}'><path fill='black' stroke='white' stroke-width='1' d='M0 0 L0 ${Math.round(20 * cursorScale)} L${Math.round(5 * cursorScale)} ${Math.round(15 * cursorScale)} L${Math.round(8 * cursorScale)} ${Math.round(22 * cursorScale)} L${Math.round(10 * cursorScale)} ${Math.round(21 * cursorScale)} L${Math.round(7 * cursorScale)} ${Math.round(14 * cursorScale)} L${Math.round(13 * cursorScale)} ${Math.round(14 * cursorScale)} Z'/></svg>") ${Math.round(cursorScale)} ${Math.round(cursorScale)}, auto`;
    } else {
      document.body.style.cursor = '';
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#data));
    } catch (e) {
      console.warn('[Settings] Failed to persist:', e);
    }
  }

  dump() { return { ...this.#data }; }
}
