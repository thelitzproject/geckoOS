/**
 * Desktop surface manager — wallpaper, icons, right-click menu.
 */
export class Desktop {
  #kernel;
  #surface;
  #items = [];           // { id, type, appId?, name, x, y, path? }
  #itemEls = new Map();  // id → element
  #selectedId = null;

  constructor(kernel) {
    this.#kernel = kernel;
    this.#surface = document.getElementById('desktop-surface');
    this._load();
    this._init();
  }

  _load() {
    try {
      const raw = localStorage.getItem('geckoOS.desktop.items');
      this.#items = raw ? JSON.parse(raw) : this._defaults();
    } catch {
      this.#items = this._defaults();
    }
  }

  _defaults() {
    return [
      { id: 'di-finder',   type: 'app', appId: 'finder',   name: 'Finder',   x: 20, y: 20  },
      { id: 'di-terminal', type: 'app', appId: 'terminal', name: 'Terminal', x: 20, y: 120 },
      { id: 'di-textpad',  type: 'app', appId: 'textpad',  name: 'TextPad',  x: 20, y: 220 },
      { id: 'di-settings', type: 'app', appId: 'settings', name: 'Settings', x: 20, y: 320 },
    ];
  }

  _save() {
    localStorage.setItem('geckoOS.desktop.items', JSON.stringify(this.#items));
  }

  _init() {
    this.#surface.addEventListener('contextmenu', e => {
      if (e.target === this.#surface || e.target.id === 'desktop-surface') {
        e.preventDefault();
        this.#kernel.contextMenu.show(e.clientX, e.clientY, this._desktopMenu());
      }
    });

    this.#surface.addEventListener('click', e => {
      if (e.target === this.#surface || e.target.id === 'desktop-surface') {
        this.#kernel.contextMenu.hide();
        this.#kernel.menubar.setActiveApp(null);
        this._deselectAll();
      }
    });

    // Support dropping app IDs dragged from the dock context menu
    this.#surface.addEventListener('dragover', e => e.preventDefault());
    this.#surface.addEventListener('drop', e => {
      e.preventDefault();
      const appId = e.dataTransfer.getData('text/gecko-appid');
      if (appId) {
        const rect = this.#surface.getBoundingClientRect();
        this.addAppToDesktop(appId, e.clientX - rect.left - 36, e.clientY - rect.top - 36);
      }
    });

    this.#items.forEach(item => this._renderItem(item));
  }

  _renderItem(item) {
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.dataset.itemId = item.id;
    el.style.cssText = [
      `position:absolute`,
      `left:${item.x}px`,
      `top:${item.y}px`,
      `display:flex`,
      `flex-direction:column`,
      `align-items:center`,
      `gap:4px`,
      `padding:6px`,
      `width:72px`,
      `cursor:pointer`,
      `border-radius:8px`,
      `transition:background 80ms`,
      `user-select:none`,
      `z-index:1`,
    ].join(';');

    let iconEl;
    if (item.type === 'app') {
      const manifest = this.#kernel.apps.get(item.appId);
      iconEl = document.createElement('img');
      iconEl.src = manifest?.icon ?? 'assets/icons/apps/about.svg';
      iconEl.alt = item.name;
      iconEl.style.cssText = 'width:48px;height:48px;border-radius:12px;pointer-events:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));';
    } else {
      iconEl = document.createElement('div');
      iconEl.textContent = '📁';
      iconEl.style.cssText = 'font-size:42px;line-height:1;pointer-events:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));';
    }

    const label = document.createElement('span');
    label.textContent = item.name;
    label.style.cssText = [
      'font-size:11px',
      'color:#fff',
      'text-align:center',
      'word-break:break-word',
      'max-width:64px',
      'overflow:hidden',
      'display:-webkit-box',
      '-webkit-line-clamp:2',
      '-webkit-box-orient:vertical',
      'text-shadow:0 1px 4px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.6)',
      'pointer-events:none',
      'line-height:1.3',
    ].join(';');

    el.append(iconEl, label);
    this._makeDraggable(el, item);

    el.addEventListener('dblclick', e => { e.stopPropagation(); this._openItem(item); });
    el.addEventListener('click',    e => { e.stopPropagation(); this._selectItem(item.id, el); });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      this._selectItem(item.id, el);
      this.#kernel.contextMenu.show(e.clientX, e.clientY, [
        { label: `Open "${item.name}"`, action: () => this._openItem(item) },
        { separator: true },
        { label: 'Add to Dock', action: () => this.#kernel.dock.pin(item.appId ?? null) },
        { separator: true },
        { label: 'Remove from Desktop', action: () => this._removeItem(item.id) },
      ]);
    });

    this.#surface.appendChild(el);
    this.#itemEls.set(item.id, el);
    return el;
  }

  _makeDraggable(el, item) {
    let dragging = false, startX, startY, origX, origY;

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX; startY = e.clientY;
      origX = item.x;     origY = item.y;
      dragging = false;

      const onMove = e2 => {
        const dx = e2.clientX - startX;
        const dy = e2.clientY - startY;
        if (!dragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) dragging = true;
        if (!dragging) return;
        item.x = Math.max(0, origX + dx);
        item.y = Math.max(0, origY + dy);
        el.style.left = item.x + 'px';
        el.style.top  = item.y + 'px';
      };

      const onUp = () => {
        if (dragging) this._save();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    });
  }

  _openItem(item) {
    if (item.type === 'app') {
      this.#kernel.openApp(item.appId);
    } else if (item.type === 'folder') {
      this.#kernel.openApp('finder', { path: item.path ?? '/home/user' });
    }
  }

  _selectItem(id, el) {
    this._deselectAll();
    this.#selectedId = id;
    el.style.background = 'rgba(0,100,255,0.25)';
  }

  _deselectAll() {
    this.#selectedId = null;
    this.#itemEls.forEach(el => { el.style.background = ''; });
  }

  _removeItem(id) {
    this.#items = this.#items.filter(i => i.id !== id);
    this.#itemEls.get(id)?.remove();
    this.#itemEls.delete(id);
    if (this.#selectedId === id) this.#selectedId = null;
    this._save();
  }

  // Public: add an app shortcut to the desktop
  addAppToDesktop(appId, x, y) {
    const manifest = this.#kernel.apps.get(appId);
    if (!manifest) return;
    if (this.#items.some(i => i.type === 'app' && i.appId === appId)) {
      this.#kernel.notify('Desktop', `${manifest.name} is already on the Desktop`);
      return;
    }
    const col = this.#items.length % 6;
    const row = Math.floor(this.#items.length / 6);
    const item = {
      id: `di-${appId}-${Date.now()}`,
      type: 'app',
      appId,
      name: manifest.name,
      x: x ?? (20 + col * 88),
      y: y ?? (20 + row * 100),
    };
    this.#items.push(item);
    this._renderItem(item);
    this._save();
  }

  _newFolder() {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    const col  = this.#items.length % 6;
    const row  = Math.floor(this.#items.length / 6);
    const path = `/home/user/Desktop/${name.trim()}`;
    const item = {
      id:   `di-folder-${Date.now()}`,
      type: 'folder',
      name: name.trim(),
      path,
      x: 20 + col * 88,
      y: 20 + row * 100,
    };
    this.#kernel.gsl.fs.mkdir(path, { recursive: true }).catch(() => {});
    this.#items.push(item);
    this._renderItem(item);
    this._save();
  }

  _desktopMenu() {
    return [
      { label: 'New Folder',        action: () => this._newFolder() },
      { separator: true },
      { label: 'Change Wallpaper',  action: () => this.#kernel.openApp('settings') },
      { separator: true },
      { label: 'Open Terminal',     action: () => this.#kernel.openApp('terminal') },
    ];
  }

  setWallpaper(url) {
    this.#surface.style.backgroundImage = `url(${url})`;
    this.#kernel.settings.set('desktop.wallpaper', url);
  }
}
