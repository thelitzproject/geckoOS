const STORAGE_KEY = 'geckoOS.settings';

const DEFAULTS = {
  'desktop.wallpaper':       'assets/wallpapers/default.jpg',
  'desktop.iconSize':        64,
  'appearance.theme':        'light',
  'appearance.accentColor':  '#007aff',
  'dock.position':           'bottom',
  'dock.autohide':           false,
  'dock.magnification':      true,
  'menubar.clock24h':        false,
  'menubar.showDate':        false,
  'startup.apps':            [],
  'accessibility.reduceMotion': false,
  'gsl.enabled':             true,
  'oobe.completed':          false,
  'user.name':               '',
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
    const theme = this.get('appearance.theme');
    root.setAttribute('data-theme', theme);

    const accent = this.get('appearance.accentColor');
    root.style.setProperty('--color-accent', accent);

    const wallpaper = this.get('desktop.wallpaper');
    const surface = document.getElementById('desktop-surface');
    // Gradient themes override the wallpaper with their own CSS variable
    const gradientThemes = ['sunset'];
    if (surface) {
      if (gradientThemes.includes(theme)) {
        surface.style.backgroundImage = 'var(--color-desktop-bg)';
      } else {
        surface.style.backgroundImage = wallpaper ? `url(${wallpaper})` : '';
      }
    }

    if (this.get('accessibility.reduceMotion')) {
      root.style.setProperty('--transition-spring', '0ms');
      root.style.setProperty('--transition-slow', '0ms');
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
