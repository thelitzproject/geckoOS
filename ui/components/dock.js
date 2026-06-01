const DEFAULT_DOCK_APPS = ['finder', 'terminal', 'textpad', 'settings', 'app-store'];

export class Dock {
  #kernel;
  #dockEl;
  #appsEl;
  #icons = new Map(); // appId → { el, dot }

  constructor(kernel) {
    this.#kernel = kernel;
    this.#dockEl = document.getElementById('dock');
    this.#appsEl = document.getElementById('dock-apps');
    this._build();
    this._initMagnification();
  }

  _build() {
    const pinned = this.#kernel.settings.get('dock.pinned', DEFAULT_DOCK_APPS);

    for (const appId of pinned) {
      const manifest = this.#kernel.apps.get(appId);
      if (!manifest) continue;
      this._addIcon(appId, manifest);
    }
  }

  _addIcon(appId, manifest) {
    const el = document.createElement('div');
    el.className = 'dock-icon';
    el.dataset.appId = appId;

    const img = document.createElement('img');
    img.src = manifest.icon;
    img.alt = manifest.name;

    const label = document.createElement('div');
    label.className = 'dock-icon-label';
    label.textContent = manifest.name;

    const dot = document.createElement('div');
    dot.className = 'dock-icon-dot';

    el.append(img, label, dot);

    el.addEventListener('click', () => {
      // If running but minimized — restore; otherwise launch
      const instances = this.#kernel.wm.getByAppId(appId);
      if (instances.length > 0) {
        instances[0].restore?.() ?? this.#kernel.wm.focus(instances[0].id);
      } else {
        this.#kernel.openApp(appId);
      }
    });

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      const items = [
        { label: `Open ${manifest.name}`, action: () => this.#kernel.openApp(appId) },
        { separator: true },
        { label: 'Options', action: () => {} },
      ];
      this.#kernel.contextMenu.show(e.clientX, e.clientY, items);
    });

    this.#appsEl.appendChild(el);
    this.#icons.set(appId, { el, dot });
  }

  bounce(appId) {
    const icon = this.#icons.get(appId);
    if (!icon) return;
    icon.el.classList.remove('bouncing');
    void icon.el.offsetWidth; // reflow to restart animation
    icon.el.classList.add('bouncing');
    icon.el.addEventListener('animationend', () => icon.el.classList.remove('bouncing'), { once: true });
  }

  setRunning(appId, running) {
    const icon = this.#icons.get(appId);
    if (!icon) return;
    icon.el.classList.toggle('running', running);
  }

  setMinimized(appId, windowId, minimized) {
    // Visual indication could go here; for now just keep dot showing
  }

  _initMagnification() {
    // CSS handles hover magnification via sibling selectors
    // This is just a hook for future JS-based physics magnification
  }
}
