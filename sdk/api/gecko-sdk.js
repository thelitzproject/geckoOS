/**
 * Gecko App SDK — public API for geckoOS apps.
 *
 * Third-party apps import from this module to interact with the OS.
 * The SDK is versioned and stable; internal gecko.* APIs are not.
 *
 * Usage in an app module:
 *   import { GeckoApp, notify, openFile, gsl } from '../../sdk/api/gecko-sdk.js';
 */

/** Base class all geckoOS apps should extend. */
export class GeckoApp {
  constructor(kernel, window, args = {}) {
    this.kernel = kernel;
    this.window = window;
    this.args   = args;
  }

  /** Called by the OS to render the app into the window content area. */
  async mount(container) {
    throw new Error('GeckoApp.mount() must be implemented');
  }

  /** Called when the window is closed. Clean up event listeners, timers, etc. */
  destroy() {}

  // Convenience wrappers

  notify(title, message, opts) {
    this.kernel.notify(title, message, opts);
  }

  openApp(id, args) {
    return this.kernel.openApp(id, args);
  }

  setTitle(t) {
    this.window.setTitle(t);
  }

  get fs()       { return this.kernel.gsl.fs; }
  get shell()    { return this.kernel.gsl.sh; }
  get settings() { return this.kernel.settings; }
  get events()   { return this.kernel.events; }
}

/**
 * Create an app manifest inline (for single-file apps).
 * @param {object} opts
 */
export function defineApp(opts) {
  return {
    id:           opts.id,
    name:         opts.name,
    icon:         opts.icon,
    category:     opts.category ?? 'utilities',
    keywords:     opts.keywords ?? [],
    defaultSize:  opts.size    ?? { width: 800, height: 600 },
    allowMultiple: opts.multi  ?? true,
    resizable:    opts.resizable ?? true,
    module:       opts.module,
  };
}

/**
 * Minimal standalone helpers — safe to call from outside an app class.
 * Require window.gecko to be initialized.
 */

export const notify = (title, msg, opts) => window.gecko?.notify(title, msg, opts);
export const openApp = (id, args)        => window.gecko?.openApp(id, args);
export const gsl     = ()                => window.gsl;
export const fs      = ()                => window.gsl?.fs;

export const SDK_VERSION = '1.0.0';
