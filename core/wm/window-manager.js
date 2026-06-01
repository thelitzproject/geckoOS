/**
 * geckoOS Window Manager
 * Handles window creation, focus, stacking, drag, resize.
 */

let nextZIndex = 100;
let nextWindowId = 1;

export class WindowManager {
  #kernel;
  #layer;
  #windows = new Map(); // id → GeckoWindow

  constructor(kernel) {
    this.#kernel = kernel;
    this.#layer = document.getElementById('window-layer');
  }

  create(opts = {}) {
    const id = nextWindowId++;
    const win = new GeckoWindow(id, opts, this.#kernel);
    this.#windows.set(id, win);
    this.#layer.appendChild(win.el);

    // Center on screen
    const desktop = document.getElementById('desktop-surface');
    const dw = desktop.clientWidth;
    const dh = desktop.clientHeight;
    const menubarH = 28;
    const dockH = 80;
    const usableH = dh - menubarH - dockH;

    const x = Math.max(0, (dw - win.width) / 2) + (id % 5) * 20;
    const y = Math.max(menubarH + 4, menubarH + (usableH - win.height) / 2) + (id % 5) * 20;
    win.moveTo(x, y);

    this.focus(id);
    return win;
  }

  focus(id) {
    const win = this.#windows.get(id);
    if (!win) return;

    // Unfocus all
    for (const w of this.#windows.values()) {
      w.el.classList.remove('focused');
      w.el.classList.add('window-unfocused');
      w.titlebar?.classList?.add('window-unfocused');
    }

    win.el.classList.add('focused');
    win.el.classList.remove('window-unfocused');
    win.titlebar?.classList?.remove('window-unfocused');
    win.el.style.zIndex = ++nextZIndex;

    this.#kernel.menubar?.setActiveApp(win.appId);
    this.#kernel.events.emit('wm:focus', { id });
  }

  close(id) {
    const win = this.#windows.get(id);
    if (!win) return;
    win._close();
    this.#windows.delete(id);
  }

  minimize(id) {
    this.#windows.get(id)?._minimize();
  }

  getAll() { return Array.from(this.#windows.values()); }

  getByAppId(appId) {
    return Array.from(this.#windows.values()).filter(w => w.appId === appId);
  }
}

class GeckoWindow {
  constructor(id, opts, kernel) {
    this.id     = id;
    this.appId  = opts.appId;
    this.title  = opts.title  ?? 'Untitled';
    this.icon   = opts.icon   ?? null;
    this.width  = opts.width  ?? 800;
    this.height = opts.height ?? 600;
    this.resizable = opts.resizable ?? true;

    this.#kernel = kernel;
    this.#onCloseCb = [];
    this.#minimized = false;

    this._build();
    this._bindDrag();
    if (this.resizable) this._bindResize();
  }

  #kernel;
  #onCloseCb;
  #minimized;
  #isDragging = false;
  #dragOffX = 0;
  #dragOffY = 0;

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'gecko-window opening';
    this.el.style.width  = `${this.width}px`;
    this.el.style.height = `${this.height}px`;
    this.el.addEventListener('mousedown', () => this.#kernel.wm.focus(this.id));

    // Title bar
    this.titlebar = document.createElement('div');
    this.titlebar.className = 'window-titlebar';

    // Traffic lights
    const controls = document.createElement('div');
    controls.className = 'window-controls';

    const close = this._makeTrafficBtn('tl-close', '✕', () => this._close());
    const min   = this._makeTrafficBtn('tl-minimize', '–', () => this._minimize());
    const max   = this._makeTrafficBtn('tl-maximize', '+', () => this._toggleMaximize());
    controls.append(close, min, max);

    // Title text
    const titleEl = document.createElement('span');
    titleEl.className = 'window-title';
    titleEl.textContent = this.title;
    this.titleEl = titleEl;

    // Spacer to balance traffic lights
    const spacer = document.createElement('div');
    spacer.style.width = `${3 * 12 + 2 * 8}px`; // 3 buttons + 2 gaps
    spacer.style.flexShrink = '0';

    this.titlebar.append(controls, titleEl, spacer);

    // Content area
    this.content = document.createElement('div');
    this.content.className = 'window-content';

    // Resize handle
    if (this.resizable) {
      const rh = document.createElement('div');
      rh.className = 'window-resize-handle';
      this.el.appendChild(rh);
      this.resizeHandle = rh;
    }

    this.el.append(this.titlebar, this.content);

    // Remove opening class after animation
    this.el.addEventListener('animationend', () => {
      this.el.classList.remove('opening');
    }, { once: true });
  }

  _makeTrafficBtn(cls, symbol, action) {
    const btn = document.createElement('button');
    btn.className = `tl-btn ${cls}`;
    btn.setAttribute('aria-label', cls.replace('tl-', ''));

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 6 6');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    path.setAttribute('x', '50%');
    path.setAttribute('y', '50%');
    path.setAttribute('dominant-baseline', 'middle');
    path.setAttribute('text-anchor', 'middle');
    path.setAttribute('font-size', '6');
    path.textContent = symbol;
    svg.appendChild(path);
    btn.appendChild(svg);

    btn.addEventListener('click', e => { e.stopPropagation(); action(); });
    return btn;
  }

  _bindDrag() {
    this.titlebar.addEventListener('mousedown', e => {
      if (e.target.closest('.window-controls')) return;
      if (e.button !== 0) return;

      this.#isDragging = true;
      this.titlebar.classList.add('dragging');

      const rect = this.el.getBoundingClientRect();
      this.#dragOffX = e.clientX - rect.left;
      this.#dragOffY = e.clientY - rect.top;

      const onMove = ev => {
        if (!this.#isDragging) return;
        const x = ev.clientX - this.#dragOffX;
        const y = Math.max(28, ev.clientY - this.#dragOffY); // Can't go above menubar
        this.el.style.left = `${x}px`;
        this.el.style.top  = `${y}px`;
      };

      const onUp = () => {
        this.#isDragging = false;
        this.titlebar.classList.remove('dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  _bindResize() {
    let resizing = false, startX, startY, startW, startH;

    this.resizeHandle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = this.el.offsetWidth;
      startH = this.el.offsetHeight;

      const onMove = ev => {
        if (!resizing) return;
        const w = Math.max(300, startW + (ev.clientX - startX));
        const h = Math.max(200, startH + (ev.clientY - startY));
        this.el.style.width  = `${w}px`;
        this.el.style.height = `${h}px`;
        this.width = w;
        this.height = h;
      };

      const onUp = () => {
        resizing = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  _toggleMaximize() {
    if (this._isMaximized) {
      this.el.style.cssText += `; left:${this._prevRect.x}px; top:${this._prevRect.y}px; width:${this._prevRect.w}px; height:${this._prevRect.h}px;`;
      this._isMaximized = false;
    } else {
      const s = document.getElementById('desktop-surface');
      this._prevRect = { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight };
      this.el.style.cssText += `; left:0px; top:28px; width:${s.clientWidth}px; height:${s.clientHeight - 28 - 80}px;`;
      this._isMaximized = true;
    }
  }

  _minimize() {
    if (this.#minimized) return;
    this.#minimized = true;
    this.el.classList.add('minimizing');
    this.el.addEventListener('animationend', () => {
      this.el.hidden = true;
      this.el.classList.remove('minimizing');
    }, { once: true });
    this.#kernel.dock.setMinimized(this.appId, this.id, true);
  }

  restore() {
    if (!this.#minimized) return;
    this.el.hidden = false;
    this.#minimized = false;
    this.el.classList.add('opening');
    this.el.addEventListener('animationend', () => this.el.classList.remove('opening'), { once: true });
    this.#kernel.wm.focus(this.id);
    this.#kernel.dock.setMinimized(this.appId, this.id, false);
  }

  _close() {
    this.el.style.transition = 'opacity 120ms ease, transform 120ms ease';
    this.el.style.opacity = '0';
    this.el.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.el.remove();
      this.#onCloseCb.forEach(fn => fn());
    }, 120);
  }

  onClose(fn) { this.#onCloseCb.push(fn); }

  setTitle(t) {
    this.title = t;
    if (this.titleEl) this.titleEl.textContent = t;
  }

  moveTo(x, y) {
    this.el.style.left = `${x}px`;
    this.el.style.top  = `${y}px`;
  }

  addToolbar(el) {
    el.classList.add('window-toolbar');
    this.titlebar.after(el);
  }
}
