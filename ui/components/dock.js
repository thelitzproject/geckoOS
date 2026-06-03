const DEFAULT_DOCK_APPS = ['finder', 'terminal', 'textpad', 'settings', 'app-store'];

export class Dock {
  #kernel;
  #dockEl;
  #appsEl;
  #icons = new Map();   // appId → { el, dot }
  #pinned = [];         // ordered list of pinned appIds

  constructor(kernel) {
    this.#kernel = kernel;
    this.#dockEl = document.getElementById('dock');
    this.#appsEl = document.getElementById('dock-apps');
    this._build();
    this._initMagnification();
    this._initDropZone();
  }

  _build() {
    this.#pinned = this.#kernel.settings.get('dock.pinned', DEFAULT_DOCK_APPS);

    for (const appId of this.#pinned) {
      const manifest = this.#kernel.apps.get(appId);
      if (!manifest) continue;
      this._addIcon(appId, manifest);
    }

    this._applyAutohide();
    this.#kernel.events.on('settings:changed', ({ key }) => {
      if (key === 'dock.autohide') this._applyAutohide();
    });
  }

  _applyAutohide() {
    const container = document.getElementById('dock-container');
    if (!container) return;
    const on = this.#kernel.settings.get('dock.autohide');
    container.classList.toggle('autohide', on);

    if (on) {
      // Show dock when cursor is near the bottom of the screen
      const trigger = e => {
        const threshold = 8;
        const nearBottom = e.clientY >= window.innerHeight - threshold;
        container.classList.toggle('force-show', nearBottom);
      };
      if (!this._autohideListener) {
        this._autohideListener = trigger;
        document.addEventListener('mousemove', trigger);
      }
    } else {
      if (this._autohideListener) {
        document.removeEventListener('mousemove', this._autohideListener);
        this._autohideListener = null;
      }
      container.classList.remove('force-show');
    }
  }

  _addIcon(appId, manifest) {
    const el = document.createElement('div');
    el.className = 'dock-icon';
    el.dataset.appId = appId;
    el.draggable = true;

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
      const instances = this.#kernel.wm.getByAppId(appId);
      if (instances.length > 0) {
        instances[0].restore?.() ?? this.#kernel.wm.focus(instances[0].id);
      } else {
        this.#kernel.openApp(appId);
      }
    });

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      const isPinned = this.#pinned.includes(appId);
      const items = [
        { label: `Open ${manifest.name}`, action: () => this.#kernel.openApp(appId) },
        { separator: true },
        { label: isPinned ? 'Remove from Dock' : 'Keep in Dock',
          action: () => isPinned ? this.unpin(appId) : this.pin(appId) },
        { label: 'Add to Desktop',
          action: () => this.#kernel.desktop.addAppToDesktop(appId) },
      ];
      this.#kernel.contextMenu.show(e.clientX, e.clientY, items);
    });

    // Drag-to-reorder within dock
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/gecko-dock-appid', appId);
      e.dataTransfer.effectAllowed = 'move';
      el.style.opacity = '0.4';
    });

    el.addEventListener('dragend', () => {
      el.style.opacity = '';
      this.#appsEl.querySelectorAll('.dock-icon').forEach(d => d.classList.remove('drag-over'));
    });

    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.#appsEl.querySelectorAll('.dock-icon').forEach(d => d.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const fromId = e.dataTransfer.getData('text/gecko-dock-appid');
      const toId   = appId;
      if (fromId && fromId !== toId) this._reorder(fromId, toId);
    });

    this.#appsEl.appendChild(el);
    this.#icons.set(appId, { el, dot });
    return el;
  }

  // Accept drops from outside the dock (e.g. desktop icons dragged to dock area)
  _initDropZone() {
    this.#dockEl.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/gecko-appid')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    this.#dockEl.addEventListener('drop', e => {
      const appId = e.dataTransfer.getData('text/gecko-appid');
      if (appId) { e.preventDefault(); this.pin(appId); }
    });
  }

  // Reorder: move fromId to the position of toId
  _reorder(fromId, toId) {
    const fromIdx = this.#pinned.indexOf(fromId);
    const toIdx   = this.#pinned.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;

    this.#pinned.splice(fromIdx, 1);
    this.#pinned.splice(toIdx, 0, fromId);
    this._savePinned();
    this._rebuild();
  }

  _rebuild() {
    // Remove all icons and re-render in new order
    const running = new Set();
    this.#icons.forEach((icon, id) => {
      if (icon.el.classList.contains('running')) running.add(id);
    });
    this.#appsEl.innerHTML = '';
    this.#icons.clear();

    for (const appId of this.#pinned) {
      const manifest = this.#kernel.apps.get(appId);
      if (!manifest) continue;
      this._addIcon(appId, manifest);
      if (running.has(appId)) this.#icons.get(appId)?.el.classList.add('running');
    }
  }

  // Pin an app to the dock (idempotent)
  pin(appId) {
    if (!appId) return;
    const manifest = this.#kernel.apps.get(appId);
    if (!manifest) return;
    if (this.#pinned.includes(appId)) {
      this.#kernel.notify('Dock', `${manifest.name} is already in the Dock`);
      return;
    }
    this.#pinned.push(appId);
    this._savePinned();
    this._addIcon(appId, manifest);
    this.#kernel.notify('Dock', `${manifest.name} added to Dock`);
  }

  // Unpin an app from the dock
  unpin(appId) {
    const manifest = this.#kernel.apps.get(appId);
    const idx = this.#pinned.indexOf(appId);
    if (idx === -1) return;
    this.#pinned.splice(idx, 1);
    this._savePinned();
    this.#icons.get(appId)?.el.remove();
    this.#icons.delete(appId);
    if (manifest) this.#kernel.notify('Dock', `${manifest.name} removed from Dock`);
  }

  _savePinned() {
    this.#kernel.settings.set('dock.pinned', this.#pinned);
  }

  bounce(appId) {
    const icon = this.#icons.get(appId);
    if (!icon) return;
    icon.el.classList.remove('bouncing');
    void icon.el.offsetWidth;
    icon.el.classList.add('bouncing');
    icon.el.addEventListener('animationend', () => icon.el.classList.remove('bouncing'), { once: true });
  }

  setRunning(appId, running) {
    const icon = this.#icons.get(appId);
    if (!icon) return;
    icon.el.classList.toggle('running', running);
  }

  setMinimized(appId, windowId, minimized) {}

  _initMagnification() {}
}
