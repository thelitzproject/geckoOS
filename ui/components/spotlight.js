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

    const appResults = this.#kernel.apps.search(query);
    const fileResults = []; // TODO: VFS search

    if (appResults.length) {
      this._addSection('Applications');
      for (const app of appResults.slice(0, 6)) {
        this._addResult({
          icon: app.icon, name: app.name,
          desc: `Application · ${app.category}`,
          action: () => { this.hide(); this.#kernel.openApp(app.id); },
        });
      }
    }

    if (!appResults.length && !fileResults.length) {
      const el = document.createElement('div');
      el.style.cssText = 'padding:20px;text-align:center;color:var(--color-text-secondary);font-size:13px';
      el.textContent = `No results for "${query}"`;
      this.#results.appendChild(el);
    }

    if (this.#resultItems.length > 0) this._select(0);
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
