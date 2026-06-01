/**
 * geckoOS 1.0.0 "Bijou"
 * Core kernel entry point — bootstraps all subsystems.
 */

import { EventBus } from './events.js';
import { Settings } from './settings.js';
import { Desktop } from '../desktop/desktop.js';
import { WindowManager } from '../wm/window-manager.js';
import { GSL } from '../../gsl/kernel/gsl.js';
import { AppManager } from './app-manager.js';
import { Dock } from '../../ui/components/dock.js';
import { MenuBar } from '../../ui/components/menubar.js';
import { Spotlight } from '../../ui/components/spotlight.js';
import { ContextMenu } from '../../ui/components/context-menu.js';
import { NotificationCenter } from '../../ui/components/notification-center.js';
import { OOBE } from '../oobe/oobe.js';

const VERSION = '1.0.0';
const CODENAME = 'Bijou';

class GeckoKernel {
  constructor() {
    this.version = VERSION;
    this.codename = CODENAME;
    this.startTime = Date.now();

    // Core subsystems — populated during boot
    this.events = null;
    this.settings = null;
    this.gsl = null;
    this.wm = null;
    this.apps = null;
    this.desktop = null;

    // UI subsystems
    this.dock = null;
    this.menubar = null;
    this.spotlight = null;
    this.contextMenu = null;
    this.notifications = null;

    // Expose globally for apps and SDK
    window.gecko = this;
  }

  async boot() {
    try {
      this._bootLog('geckoOS kernel starting...');

      // Phase 0 — Service worker (UV proxy + asset caching)
      // Fire-and-forget: register early so the SW has time to activate before
      // the user opens Browser. skipWaiting + clients.claim() in sw.js means
      // the SW is typically active within ~200 ms of page load.
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(r => this._bootLog(`SW registered (${r.active ? 'active' : 'installing'})`))
          .catch(e => console.warn('[gecko] SW registration failed:', e));
      }

      // Phase 1 — Core services (no DOM required)
      this.events = new EventBus();
      this.settings = new Settings(this);
      await this.settings.load();
      this._bootLog('Core services ready');

      // Phase 2 — GSL (Gecko Subsystem for Linux)
      this.gsl = new GSL(this);
      await this.gsl.init();
      this._bootLog('GSL ready');

      // Phase 3 — App registry
      this.apps = new AppManager(this);
      await this.apps.load();
      this._bootLog('App manager ready');

      // Phase 4 — Window manager + Desktop (DOM)
      this.wm = new WindowManager(this);
      this.desktop = new Desktop(this);
      this._bootLog('Desktop ready');

      // Phase 5 — UI chrome
      this.menubar = new MenuBar(this);
      this.dock = new Dock(this);
      this.spotlight = new Spotlight(this);
      this.contextMenu = new ContextMenu(this);
      this.notifications = new NotificationCenter(this);
      this._bootLog('UI chrome ready');

      // Phase 6 — OOBE (first-run setup) or straight to desktop
      // Navigate to #setup (e.g. reload with #setup in the URL) to force re-run.
      const forceOOBE = location.hash === '#setup';
      if (forceOOBE) { this.settings.reset('oobe.completed'); location.hash = ''; }

      if (!this.settings.get('oobe.completed')) {
        const oobe = new OOBE(this);
        await this._showDesktop();
        await oobe.run();
      } else {
        await this._showDesktop();
      }

      this._bootLog(`Boot complete in ${Date.now() - this.startTime}ms`);
      this.events.emit('gecko:ready');

    } catch (err) {
      console.error('[gecko] Boot failed:', err);
      this._bootFail(err);
    }
  }

  async _showDesktop() {
    const bootScreen = document.getElementById('gecko-boot-screen');
    const desktopEl  = document.getElementById('gecko-desktop');

    // Minimum splash time so users see the branding
    const elapsed = Date.now() - this.startTime;
    if (elapsed < 1200) {
      await this._sleep(1200 - elapsed);
    }

    bootScreen.style.transition = 'opacity 400ms ease';
    bootScreen.style.opacity = '0';
    await this._sleep(400);
    bootScreen.hidden = true;

    desktopEl.hidden = false;
    desktopEl.style.opacity = '0';
    desktopEl.style.transition = 'opacity 300ms ease';
    requestAnimationFrame(() => { desktopEl.style.opacity = '1'; });

    // Apply persisted settings to DOM
    this.settings.apply();

    // Launch startup apps
    for (const appId of this.settings.get('startup.apps', [])) {
      this.apps.launch(appId).catch(() => {});
    }
  }

  _bootFail(err) {
    const boot = document.getElementById('gecko-boot-screen');
    boot.innerHTML = `
      <div style="color:#ff3b30;font-family:monospace;padding:40px;max-width:600px;margin:auto">
        <h2 style="font-size:24px;margin-bottom:16px">Kernel Panic</h2>
        <p>geckoOS failed to start:</p>
        <pre style="margin-top:12px;font-size:12px;white-space:pre-wrap">${err?.stack ?? err}</pre>
        <button onclick="location.reload()" style="margin-top:24px;padding:8px 20px;background:#ff3b30;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Restart</button>
      </div>`;
  }

  _bootLog(msg) {
    console.log(`[gecko ${Date.now() - this.startTime}ms] ${msg}`);
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Public API —————————————————————————————————————————

  notify(title, message, opts = {}) {
    this.notifications.push({ title, message, ...opts });
  }

  openApp(appId, args) {
    return this.apps.launch(appId, args);
  }
}

// Boot when DOM is ready
const kernel = new GeckoKernel();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => kernel.boot());
} else {
  kernel.boot();
}

export { kernel as gecko };
