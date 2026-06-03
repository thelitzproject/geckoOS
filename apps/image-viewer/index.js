export default class ImageViewerApp {
  #kernel; #win;
  #filePath;
  #imgEl;
  #zoom = 1;
  #panX = 0; #panY = 0;
  #dragging = false;
  #dragStartX = 0; #dragStartY = 0;
  #panStartX = 0; #panStartY = 0;

  constructor(kernel, win, args) {
    this.#kernel   = kernel;
    this.#win      = win;
    this.#filePath = args?.path ?? null;
    const name = this.#filePath?.split('/').pop() ?? 'Image Viewer';
    win.setTitle(name);
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#0a0a0a;overflow:hidden;';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(30,30,30,0.95);border-bottom:0.5px solid rgba(255,255,255,0.08);flex-shrink:0;';

    const zoomOut  = this._btn('−', () => this._setZoom(this.#zoom / 1.25));
    const zoomIn   = this._btn('+', () => this._setZoom(this.#zoom * 1.25));
    const fitBtn   = this._btn('Fit',  () => this._fitToWindow());
    const origBtn  = this._btn('100%', () => this._setZoom(1));
    const openBtn  = this._btn('Open…', () => this._pickFile());

    this.#zoomLabel = document.createElement('span');
    this.#zoomLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);min-width:40px;text-align:center;';

    this.#filenameEl = document.createElement('span');
    this.#filenameEl.style.cssText = 'flex:1;font-size:12px;color:rgba(255,255,255,0.6);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    this.#filenameEl.textContent = this.#filePath?.split('/').pop() ?? '';

    toolbar.append(openBtn, this.#filenameEl, zoomOut, this.#zoomLabel, zoomIn, fitBtn, origBtn);
    this.#win.addToolbar(toolbar);

    // Viewport
    const viewport = document.createElement('div');
    viewport.style.cssText = 'flex:1;overflow:hidden;position:relative;cursor:grab;display:flex;align-items:center;justify-content:center;';

    this.#imgEl = document.createElement('img');
    this.#imgEl.style.cssText = 'max-width:none;max-height:none;display:block;transform-origin:center center;user-select:none;pointer-events:none;border-radius:2px;';
    this.#imgEl.draggable = false;

    viewport.appendChild(this.#imgEl);
    container.appendChild(viewport);

    // Pan via mouse drag
    viewport.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      this.#dragging = true;
      this.#dragStartX = e.clientX; this.#dragStartY = e.clientY;
      this.#panStartX = this.#panX; this.#panStartY = this.#panY;
      viewport.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!this.#dragging) return;
      this.#panX = this.#panStartX + (e.clientX - this.#dragStartX);
      this.#panY = this.#panStartY + (e.clientY - this.#dragStartY);
      this._applyTransform();
    });
    window.addEventListener('mouseup', () => { this.#dragging = false; viewport.style.cursor = 'grab'; });

    // Scroll to zoom
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this._setZoom(this.#zoom * factor);
    }, { passive: false });

    // Keyboard
    container.setAttribute('tabindex', '-1');
    container.addEventListener('keydown', e => {
      if (e.key === '=' || e.key === '+') this._setZoom(this.#zoom * 1.25);
      if (e.key === '-') this._setZoom(this.#zoom / 1.25);
      if (e.key === '0' || e.key === 'f') this._fitToWindow();
      if (e.key === '1') this._setZoom(1);
    });

    this._viewport = viewport;

    if (this.#filePath) {
      await this._loadImage(this.#filePath);
    } else {
      this._showPlaceholder();
    }
  }

  _btn(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:3px 9px;background:rgba(255,255,255,0.1);border:0.5px solid rgba(255,255,255,0.15);border-radius:5px;font-size:12px;cursor:pointer;color:rgba(255,255,255,0.8);';
    btn.addEventListener('click', action);
    return btn;
  }

  async _loadImage(path) {
    try {
      const data = await this.#kernel.gsl.fs.readFile(path, { encoding: 'binary' });
      const ext  = path.split('.').pop().toLowerCase();
      const mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
                     svg:'image/svg+xml', webp:'image/webp', bmp:'image/bmp', ico:'image/x-icon' }[ext] ?? 'image/png';

      let src;
      if (typeof data === 'string') {
        // Text SVG or base64-able content
        src = `data:${mime};base64,${btoa(data)}`;
      } else {
        const blob = new Blob([data], { type: mime });
        src = URL.createObjectURL(blob);
      }

      this.#imgEl.onload = () => {
        this.#win.setTitle(path.split('/').pop());
        if (this.#filenameEl) this.#filenameEl.textContent = path.split('/').pop();
        this._fitToWindow();
      };
      this.#imgEl.onerror = () => { this._showError(path); };
      this.#imgEl.src = src;
      this.#filePath = path;
    } catch (e) {
      this._showError(path, e.message);
    }
  }

  _showPlaceholder() {
    this.#imgEl.style.display = 'none';
    const ph = document.createElement('div');
    ph.style.cssText = 'color:rgba(255,255,255,0.3);font-size:14px;text-align:center;padding:40px;';
    ph.innerHTML = '<div style="font-size:48px;margin-bottom:12px">🖼</div>No image selected<br><span style="font-size:12px;margin-top:6px;display:block;">Use Open… to browse files</span>';
    this._viewport.appendChild(ph);
  }

  _showError(path, msg) {
    this.#imgEl.style.display = 'none';
    const err = document.createElement('div');
    err.style.cssText = 'color:rgba(255,80,80,0.8);font-size:13px;text-align:center;padding:40px;';
    err.innerHTML = `<div style="font-size:36px;margin-bottom:10px">⚠️</div>Cannot load image<br><span style="font-size:11px;color:rgba(255,255,255,0.3);">${path.split('/').pop()}${msg ? ` — ${msg}` : ''}</span>`;
    this._viewport.appendChild(err);
  }

  _setZoom(z) {
    this.#zoom = Math.max(0.05, Math.min(10, z));
    this._applyTransform();
    this.#zoomLabel.textContent = `${Math.round(this.#zoom * 100)}%`;
  }

  _fitToWindow() {
    if (!this.#imgEl.naturalWidth) return;
    const vw = this._viewport.clientWidth  - 32;
    const vh = this._viewport.clientHeight - 32;
    const scale = Math.min(vw / this.#imgEl.naturalWidth, vh / this.#imgEl.naturalHeight, 1);
    this.#panX = 0; this.#panY = 0;
    this._setZoom(scale);
  }

  _applyTransform() {
    this.#imgEl.style.transform = `translate(${this.#panX}px, ${this.#panY}px) scale(${this.#zoom})`;
  }

  async _pickFile() {
    const { FilePicker } = await import('../../ui/components/file-picker.js');
    const picker = new FilePicker(this.#kernel);
    const path = await picker.open({ mode: 'open', startDir: '/home/user/Pictures' });
    if (path) await this._loadImage(path);
  }

  destroy() {}
}
