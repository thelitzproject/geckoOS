export class Spotlight {
  #kernel;
  #overlay;
  #input;
  #results;
  #selectedIdx = -1;
  #resultItems = [];

  constructor(kernel) {
    this.#kernel  = kernel;
    this.#overlay = document.getElementById('spotlight-overlay');
    this.#input   = document.getElementById('spotlight-input');
    this.#results = document.getElementById('spotlight-results');

    this._bind();
  }

  _bind() {
    // Cmd+Space / Ctrl+Space to toggle
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && !this.#overlay.hidden) {
        this.hide();
      }
    });

    document.getElementById('spotlight-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      this.toggle();
    });

    this.#overlay.addEventListener('click', e => {
      if (e.target === this.#overlay) this.hide();
    });

    this.#input.addEventListener('input', () => this._search(this.#input.value));

    this.#input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this._moveSelection(1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this._moveSelection(-1); }
      if (e.key === 'Enter')     { e.preventDefault(); this._activateSelected(); }
    });
  }

  toggle() {
    this.#overlay.hidden ? this.show() : this.hide();
  }

  show() {
    this.#overlay.hidden = false;
    this.#input.value = '';
    this.#results.innerHTML = '';
    this.#selectedIdx = -1;
    setTimeout(() => this.#input.focus(), 50);
  }

  hide() {
    this.#overlay.hidden = true;
    this.#input.blur();
  }

  _search(query) {
    this.#results.innerHTML = '';
    this.#resultItems = [];
    this.#selectedIdx = -1;
    if (!query.trim()) return;
    this._searchAsync(query);
  }

  async _searchAsync(query) {

    const appResults = this.#kernel.apps.search(query);

    if (appResults.length) {
      this._addSection('Applications');
      for (const app of appResults.slice(0, 5)) {
        this._addResult({
          icon: app.icon, name: app.name,
          desc: `Application · ${app.category}`,
          action: () => { this.hide(); this.#kernel.openApp(app.id); },
        });
      }
    }

    if (this.#resultItems.length > 0) this._select(0);

    // VFS file search runs async — append results as they arrive
    this._searchFiles(query.trim()).then(fileResults => {
      if (!fileResults.length && !appResults.length) {
        const el = document.createElement('div');
        el.style.cssText = 'padding:20px;text-align:center;color:var(--color-text-secondary);font-size:13px';
        el.textContent = `No results for "${query}"`;
        this.#results.appendChild(el);
        return;
      }
      if (!fileResults.length) return;
      this._addSection('Files');
      for (const f of fileResults.slice(0, 8)) {
        const ext   = f.name.split('.').pop().toLowerCase();
        const emoji = { png:'🖼',jpg:'🖼',jpeg:'🖼',svg:'🖼',txt:'📝',md:'📝',js:'📄',json:'📋' }[ext] ?? '📄';
        const idx = this.#resultItems.length;
        this._addResult({
          icon: null, emoji, name: f.name, desc: f.path,
          action: () => {
            this.hide();
            const textExts = ['txt','md','json','js','ts','css','html','sh'];
            const imgExts  = ['png','jpg','jpeg','gif','svg','webp'];
            if (textExts.includes(ext)) this.#kernel.openApp('textpad', { path: f.path });
            else if (imgExts.includes(ext)) this.#kernel.openApp('image-viewer', { path: f.path });
            else this.#kernel.openApp('finder', { path: f.path.split('/').slice(0,-1).join('/') });
          },
        });
        if (idx === 0 && this.#selectedIdx === -1) this._select(0);
      }
    });
  }

  async _searchFiles(query) {
    if (!this.#kernel.gsl?.fs) return [];
    const q = query.toLowerCase();
    const results = [];
    const dirs = ['/home/user', '/home/user/Documents', '/home/user/Desktop', '/home/user/Downloads', '/home/user/Pictures'];
    const visited = new Set();

    const scan = async (dir, depth) => {
      if (depth > 2 || visited.has(dir) || results.length >= 20) return;
      visited.add(dir);
      let entries;
      try { entries = await this.#kernel.gsl.fs.readdir(dir); } catch { return; }
      for (const name of entries) {
        if (results.length >= 20) return;
        const fp = `${dir}/${name}`;
        if (name.toLowerCase().includes(q)) results.push({ name, path: fp });
        try {
          const stat = await this.#kernel.gsl.fs.stat(fp);
          if (stat.type === 'dir') await scan(fp, depth + 1);
        } catch {}
      }
    };

    await Promise.all(dirs.map(d => scan(d, 0)));
    return results;
  }

  _addSection(title) {
    const el = document.createElement('div');
    el.className = 'spotlight-section-header';
    el.textContent = title;
    this.#results.appendChild(el);
  }

  _addResult({ icon, name, desc, action }) {
    const el = document.createElement('div');
    el.className = 'spotlight-result';
    el.innerHTML = `
      <img src="${icon}" alt="" />
      <div class="spotlight-result-info">
        <div class="spotlight-result-name">${name}</div>
        <div class="spotlight-result-desc">${desc}</div>
      </div>`;
    el.addEventListener('click', action);
    this.#results.appendChild(el);
    this.#resultItems.push({ el, action });
    const idx = this.#resultItems.length - 1;
    el.addEventListener('mouseenter', () => this._select(idx));
  }

  _moveSelection(delta) {
    const next = Math.max(0, Math.min(this.#resultItems.length - 1, this.#selectedIdx + delta));
    this._select(next);
  }

  _select(idx) {
    this.#resultItems[this.#selectedIdx]?.el.classList.remove('selected');
    this.#selectedIdx = idx;
    this.#resultItems[idx]?.el.classList.add('selected');
    this.#resultItems[idx]?.el.scrollIntoView({ block: 'nearest' });
  }

  _activateSelected() {
    this.#resultItems[this.#selectedIdx]?.action?.();
  }
}
