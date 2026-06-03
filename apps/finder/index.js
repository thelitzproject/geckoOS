/**
 * Finder — macOS-style file manager powered by GSL VFS
 */
export default class FinderApp {
  #kernel; #win;
  #cwd      = '/home/user';
  #history  = ['/home/user'];
  #histIdx  = 0;
  #view     = 'grid';        // 'grid' | 'list'
  #contentEl;
  #breadcrumbEl;
  #searchEl;
  #clipboard = null;         // { op:'copy'|'cut', paths:string[] }

  constructor(kernel, win, args) {
    this.#kernel = kernel;
    this.#win    = win;
    if (args?.path) { this.#cwd = args.path; this.#history = [args.path]; }
    win.setTitle('Finder');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;height:100%;background:var(--color-window-bg);';

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.style.cssText = 'width:180px;flex-shrink:0;background:var(--color-sidebar-bg);border-right:0.5px solid var(--color-separator);overflow-y:auto;padding:8px 0;';
    sidebar.innerHTML = this._sidebarHTML();
    sidebar.querySelectorAll('[data-path]').forEach(el =>
      el.addEventListener('click', () => this._navigate(el.dataset.path))
    );

    // Main
    const main = document.createElement('div');
    main.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
    main.appendChild(this._buildToolbar());

    this.#contentEl = document.createElement('div');
    this.#contentEl.style.cssText = 'flex:1;overflow-y:auto;';
    this._styleContentEl();

    // Content drop zone
    this.#contentEl.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/gecko-finder-path')) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        this.#contentEl.style.outline = '2px dashed var(--color-accent)';
        this.#contentEl.style.outlineOffset = '-4px';
      }
    });
    this.#contentEl.addEventListener('dragleave', () => { this.#contentEl.style.outline = ''; });
    this.#contentEl.addEventListener('drop', async e => {
      this.#contentEl.style.outline = '';
      const src = e.dataTransfer.getData('text/gecko-finder-path');
      if (!src) return;
      e.preventDefault();
      const dst = `${this.#cwd}/${src.split('/').pop()}`;
      if (src === dst) return;
      try { await this.#kernel.gsl.fs.rename(src, dst); await this._refresh(); }
      catch (err) { this.#kernel.notify('Finder', `Move failed: ${err.message}`); }
    });

    // Keyboard
    container.setAttribute('tabindex', '-1');
    container.addEventListener('keydown', e => this._onKey(e));

    main.appendChild(this.#contentEl);
    container.append(sidebar, main);
    await this._navigate(this.#cwd);
  }

  _styleContentEl() {
    if (this.#view === 'grid') {
      this.#contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:12px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;';
    } else {
      this.#contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:0;';
    }
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  _buildToolbar() {
    const tb = document.createElement('div');
    tb.style.cssText = 'display:flex;flex-direction:column;flex-shrink:0;';

    // Row 1: nav + breadcrumb + search + view toggle
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:0.5px solid var(--color-separator);';

    const backBtn = this._tbBtn('←', () => this._goBack());
    const fwdBtn  = this._tbBtn('→', () => this._goForward());

    // Breadcrumb bar
    this.#breadcrumbEl = document.createElement('div');
    this.#breadcrumbEl.style.cssText = 'flex:1;display:flex;align-items:center;flex-wrap:wrap;gap:2px;font-size:12px;color:var(--color-text-secondary);min-width:0;';

    // Search input
    this.#searchEl = document.createElement('input');
    this.#searchEl.type = 'search';
    this.#searchEl.placeholder = 'Search…';
    this.#searchEl.style.cssText = 'padding:3px 8px;border:0.5px solid var(--color-border);border-radius:6px;background:var(--color-surface-2);font-size:12px;color:var(--color-text-primary);width:130px;outline:none;';
    this.#searchEl.addEventListener('input', () => this._onSearch(this.#searchEl.value));

    // View toggle
    const gridBtn = this._tbBtn('⊞', () => this._setView('grid'));
    const listBtn = this._tbBtn('☰', () => this._setView('list'));
    gridBtn.title = 'Icon view';
    listBtn.title = 'List view';

    const newFolder = this._tbBtn('New Folder', async () => {
      const name = prompt('Folder name:');
      if (name?.trim()) {
        await this.#kernel.gsl.fs.mkdir(`${this.#cwd}/${name.trim()}`);
        await this._refresh();
      }
    });

    row1.append(backBtn, fwdBtn, this.#breadcrumbEl, this.#searchEl, gridBtn, listBtn, newFolder);
    tb.appendChild(row1);

    // Row 2: list view header (hidden when in grid mode)
    this._listHeader = document.createElement('div');
    this._listHeader.style.cssText = [
      'display:none', 'align-items:center', 'padding:4px 12px',
      'border-bottom:0.5px solid var(--color-separator)',
      'background:var(--color-surface-2)',
      'font-size:11px', 'font-weight:600',
      'color:var(--color-text-tertiary)',
      'text-transform:uppercase', 'letter-spacing:.04em',
      'gap:0',
    ].join(';');
    this._listHeader.innerHTML = `
      <span style="flex:1;min-width:0;">Name</span>
      <span style="width:80px;text-align:right;">Size</span>
      <span style="width:80px;text-align:right;padding-right:8px;">Kind</span>
      <span style="width:120px;text-align:right;padding-right:12px;">Modified</span>`;
    tb.appendChild(this._listHeader);

    return tb;
  }

  _tbBtn(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:3px 8px;background:var(--color-surface-2);border:0.5px solid var(--color-border);border-radius:5px;font-size:12px;cursor:pointer;color:var(--color-text-primary);white-space:nowrap;flex-shrink:0;';
    btn.addEventListener('click', action);
    return btn;
  }

  _setView(v) {
    this.#view = v;
    this._styleContentEl();
    this._listHeader.style.display = v === 'list' ? 'flex' : 'none';
    this._refresh();
  }

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  _renderBreadcrumb() {
    this.#breadcrumbEl.innerHTML = '';
    const parts = this.#cwd === '/' ? [''] : this.#cwd.split('/');
    let built = '';
    parts.forEach((part, i) => {
      built = i === 0 ? '/' : `${built}/${part}`;
      const label = part === '' ? '/' : part;
      const path  = built;

      const seg = document.createElement('span');
      seg.textContent = label;
      seg.style.cssText = 'cursor:pointer;color:var(--color-text-secondary);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      seg.addEventListener('click', () => this._navigate(path));
      seg.addEventListener('mouseenter', () => seg.style.color = 'var(--color-accent)');
      seg.addEventListener('mouseleave', () => seg.style.color = 'var(--color-text-secondary)');
      this.#breadcrumbEl.appendChild(seg);

      if (i < parts.length - 1) {
        const sep = document.createElement('span');
        sep.textContent = '/';
        sep.style.cssText = 'color:var(--color-text-tertiary);margin:0 2px;flex-shrink:0;';
        this.#breadcrumbEl.appendChild(sep);
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async _navigate(path) {
    try {
      const resolved = this.#kernel.gsl.fs.resolve(this.#cwd, path);
      const stat = await this.#kernel.gsl.fs.stat(resolved);
      if (stat.type !== 'dir') { await this._openFile(resolved); return; }

      this.#cwd = resolved;
      if (this.#histIdx < this.#history.length - 1)
        this.#history = this.#history.slice(0, this.#histIdx + 1);
      this.#history.push(resolved);
      this.#histIdx = this.#history.length - 1;

      if (this.#searchEl) this.#searchEl.value = '';
      await this._refresh();
    } catch (e) {
      this.#kernel.notify('Finder', `Cannot open: ${e.message}`);
    }
  }

  async _refresh() {
    this.#win.setTitle(`Finder — ${this.#cwd}`);
    this._renderBreadcrumb();
    this.#contentEl.innerHTML = '';

    let entries;
    try { entries = await this.#kernel.gsl.fs.readdir(this.#cwd); }
    catch { return; }

    const stats = await Promise.all(entries.sort().map(async name => {
      const fp = `${this.#cwd}/${name}`;
      let stat = null;
      try { stat = await this.#kernel.gsl.fs.stat(fp); } catch {}
      return { name, fp, stat };
    }));

    if (this.#view === 'list') {
      for (const { name, fp, stat } of stats) {
        if (!stat) continue;
        this.#contentEl.appendChild(this._buildListRow(name, fp, stat));
      }
    } else {
      for (const { name, fp, stat } of stats) {
        if (!stat) continue;
        this.#contentEl.appendChild(this._buildGridItem(name, fp, stat));
      }
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async _onSearch(query) {
    if (!query.trim()) { await this._refresh(); return; }
    this.#contentEl.innerHTML = '';
    this._renderBreadcrumb();

    let entries;
    try { entries = await this.#kernel.gsl.fs.readdir(this.#cwd); }
    catch { return; }

    const q = query.toLowerCase();
    const matched = entries.filter(n => n.toLowerCase().includes(q)).sort();

    if (!matched.length) {
      const msg = document.createElement('div');
      msg.style.cssText = 'padding:40px;text-align:center;color:var(--color-text-tertiary);font-size:13px;width:100%;';
      msg.textContent = `No results for "${query}"`;
      this.#contentEl.appendChild(msg);
      return;
    }

    for (const name of matched) {
      const fp = `${this.#cwd}/${name}`;
      let stat = null;
      try { stat = await this.#kernel.gsl.fs.stat(fp); } catch {}
      if (!stat) continue;
      this.#contentEl.appendChild(
        this.#view === 'list'
          ? this._buildListRow(name, fp, stat)
          : this._buildGridItem(name, fp, stat)
      );
    }
  }

  // ── Grid item ─────────────────────────────────────────────────────────────

  _buildGridItem(name, fullPath, stat) {
    const isDir = stat.type === 'dir';
    const item  = document.createElement('div');
    item.draggable = true;
    item.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;width:80px;cursor:pointer;border-radius:6px;transition:background 80ms;';

    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'font-size:32px;pointer-events:none;';
    iconEl.textContent = isDir ? '📁' : this._fileEmoji(name);

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'font-size:11px;text-align:center;word-break:break-all;max-width:72px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--color-text-primary);';
    labelEl.textContent = name;

    item.append(iconEl, labelEl);
    this._attachItemBehavior(item, name, fullPath, stat);
    return item;
  }

  // ── List row ──────────────────────────────────────────────────────────────

  _buildListRow(name, fullPath, stat) {
    const isDir = stat.type === 'dir';
    const row   = document.createElement('div');
    row.draggable = true;
    row.style.cssText = [
      'display:flex', 'align-items:center', 'padding:5px 12px',
      'border-bottom:0.5px solid var(--color-separator)',
      'cursor:pointer', 'gap:8px',
      'transition:background 60ms',
    ].join(';');

    const icon = document.createElement('span');
    icon.textContent = isDir ? '📁' : this._fileEmoji(name);
    icon.style.cssText = 'font-size:16px;flex-shrink:0;pointer-events:none;';

    const nameEl = document.createElement('span');
    nameEl.textContent = name;
    nameEl.style.cssText = 'flex:1;font-size:13px;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;';

    const sizeEl = document.createElement('span');
    sizeEl.textContent = isDir ? '—' : this._fmtSize(stat.size ?? 0);
    sizeEl.style.cssText = 'width:80px;text-align:right;font-size:12px;color:var(--color-text-secondary);flex-shrink:0;';

    const kindEl = document.createElement('span');
    kindEl.textContent = isDir ? 'Folder' : (name.split('.').pop().toUpperCase() + ' File');
    kindEl.style.cssText = 'width:80px;text-align:right;font-size:12px;color:var(--color-text-secondary);flex-shrink:0;padding-right:8px;overflow:hidden;text-overflow:ellipsis;';

    const mtime = stat.mtime ? new Date(stat.mtime).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) : '—';
    const dateEl = document.createElement('span');
    dateEl.textContent = mtime;
    dateEl.style.cssText = 'width:120px;text-align:right;font-size:12px;color:var(--color-text-secondary);flex-shrink:0;padding-right:12px;';

    row.append(icon, nameEl, sizeEl, kindEl, dateEl);
    this._attachItemBehavior(row, name, fullPath, stat);
    return row;
  }

  // ── Shared item behavior ──────────────────────────────────────────────────

  _attachItemBehavior(el, name, fullPath, stat) {
    const isDir = stat.type === 'dir';

    el.addEventListener('mouseenter', () => el.style.background = 'var(--color-sidebar-hover)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('dblclick',  () => this._navigate(fullPath));

    // Drag source
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/gecko-finder-path', fullPath);
      e.dataTransfer.effectAllowed = 'move';
      el.style.opacity = '0.45';
    });
    el.addEventListener('dragend', () => { el.style.opacity = ''; });

    // Drop target (dirs only)
    if (isDir) {
      el.addEventListener('dragover', e => {
        if (e.dataTransfer.types.includes('text/gecko-finder-path')) {
          e.preventDefault(); e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          el.style.background = 'var(--color-accent-muted, rgba(0,122,255,0.2))';
        }
      });
      el.addEventListener('dragleave', () => { el.style.background = ''; });
      el.addEventListener('drop', async e => {
        e.preventDefault(); e.stopPropagation();
        el.style.background = '';
        const src = e.dataTransfer.getData('text/gecko-finder-path');
        if (!src || src === fullPath) return;
        try {
          await this.#kernel.gsl.fs.rename(src, `${fullPath}/${src.split('/').pop()}`);
          await this._refresh();
        } catch (err) { this.#kernel.notify('Finder', `Move failed: ${err.message}`); }
      });
    }

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.#kernel.contextMenu.show(e.clientX, e.clientY, [
        { label: 'Open',   action: () => this._navigate(fullPath) },
        { label: 'Rename', action: () => this._rename(name, fullPath) },
        { separator: true },
        { label: 'Copy',   action: () => { this.#clipboard = { op:'copy', paths:[fullPath] }; } },
        { label: 'Cut',    action: () => { this.#clipboard = { op:'cut',  paths:[fullPath] }; } },
        { separator: true },
        { label: 'Move to Trash', action: () => this._trash(fullPath, stat.type) },
        { separator: true },
        { label: 'Get Info', action: () => this._showInfo(name, fullPath, stat) },
      ]);
    });
  }

  // ── File ops ──────────────────────────────────────────────────────────────

  _fileEmoji(name) {
    const ext = name.split('.').pop().toLowerCase();
    return { js:'📄',ts:'📄',json:'📋',txt:'📝',md:'📝',sh:'📄',html:'🌐',css:'🎨',
      png:'🖼',jpg:'🖼',jpeg:'🖼',svg:'🖼',gif:'🖼',webp:'🖼',mp3:'🎵',mp4:'🎬' }[ext] ?? '📄';
  }

  _fmtSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024**2) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024**2).toFixed(1)} MB`;
  }

  async _openFile(path) {
    const ext = path.split('.').pop().toLowerCase();
    if (['txt','md','json','js','ts','css','html','sh'].includes(ext)) {
      this.#kernel.openApp('textpad', { path });
    } else if (['png','jpg','jpeg','gif','svg','webp','bmp','ico'].includes(ext)) {
      this.#kernel.openApp('image-viewer', { path });
    } else {
      this.#kernel.notify('Finder', `Cannot open: ${path.split('/').pop()}`);
    }
  }

  async _rename(oldName, fullPath) {
    const newName = prompt('New name:', oldName);
    if (newName?.trim() && newName !== oldName) {
      await this.#kernel.gsl.fs.rename(fullPath, `${this.#cwd}/${newName.trim()}`);
      await this._refresh();
    }
  }

  async _trash(path, type) {
    try {
      if (type === 'dir') await this.#kernel.gsl.fs.rmdir(path, { recursive: true });
      else await this.#kernel.gsl.fs.unlink(path);
      await this._refresh();
    } catch (e) { this.#kernel.notify('Finder', `Cannot delete: ${e.message}`); }
  }

  // ── Get Info ──────────────────────────────────────────────────────────────

  _showInfo(name, fullPath, stat) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--color-window-bg);border:0.5px solid var(--color-border);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);width:320px;padding:20px 24px 24px;font-size:13px;color:var(--color-text-primary);';

    const isDir = stat.type === 'dir';
    const icon  = isDir ? '📁' : this._fileEmoji(name);
    const kind  = isDir ? 'Folder' : `${name.split('.').pop().toUpperCase()} File`;
    const size  = isDir ? '—' : this._fmtSize(stat.size ?? 0);
    const mtime = stat.mtime ? new Date(stat.mtime).toLocaleString() : '—';
    const ctime = stat.ctime ? new Date(stat.ctime).toLocaleString() : '—';
    const mode  = stat.mode  ? stat.mode.toString(8) : '644';

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;border-bottom:0.5px solid var(--color-separator);padding-bottom:16px;">
        <span style="font-size:40px">${icon}</span>
        <div><div style="font-weight:600;font-size:15px;word-break:break-all;">${name}</div><div style="color:var(--color-text-secondary);font-size:12px;">${kind}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;line-height:1.8;">
        <tr><td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;vertical-align:top;">Where</td><td style="word-break:break-all;">${fullPath}</td></tr>
        <tr><td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;">Size</td><td>${size}</td></tr>
        <tr><td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;">Kind</td><td>${kind}</td></tr>
        <tr><td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;">Modified</td><td>${mtime}</td></tr>
        <tr><td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;">Created</td><td>${ctime}</td></tr>
        <tr><td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;">Permissions</td><td>${mode}</td></tr>
      </table>
      <div style="margin-top:20px;display:flex;justify-content:flex-end;">
        <button id="info-close" style="padding:5px 18px;background:var(--color-accent);color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">Done</button>
      </div>`;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    panel.querySelector('#info-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  // ── Clipboard ─────────────────────────────────────────────────────────────

  async _onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') { e.preventDefault(); await this._paste(); }
  }

  async _paste() {
    if (!this.#clipboard) return;
    const { op, paths } = this.#clipboard;
    for (const src of paths) {
      const dst = `${this.#cwd}/${src.split('/').pop()}`;
      try {
        if (op === 'cut') { await this.#kernel.gsl.fs.rename(src, dst); }
        else { await this.#kernel.gsl.fs.writeFile(dst, await this.#kernel.gsl.fs.readFile(src, { encoding:'binary' })); }
      } catch (err) { this.#kernel.notify('Finder', `Paste failed: ${err.message}`); }
    }
    if (op === 'cut') this.#clipboard = null;
    await this._refresh();
  }

  _goBack()    { if (this.#histIdx > 0) { this.#histIdx--; this.#cwd = this.#history[this.#histIdx]; this._refresh(); } }
  _goForward() { if (this.#histIdx < this.#history.length - 1) { this.#histIdx++; this.#cwd = this.#history[this.#histIdx]; this._refresh(); } }

  _sidebarHTML() {
    const sections = [
      { title: 'Favourites', items: [
        { label: '🏠 Home',      path: '/home/user' },
        { label: '🖥 Desktop',   path: '/home/user/Desktop' },
        { label: '📄 Documents', path: '/home/user/Documents' },
        { label: '⬇ Downloads', path: '/home/user/Downloads' },
        { label: '🖼 Pictures',  path: '/home/user/Pictures' },
        { label: '🎵 Music',     path: '/home/user/Music' },
      ]},
      { title: 'Locations', items: [
        { label: '/ Root', path: '/' },
        { label: '/etc',   path: '/etc' },
        { label: '/usr',   path: '/usr' },
        { label: '/tmp',   path: '/tmp' },
      ]},
    ];
    return sections.map(s => `
      <div style="padding:4px 12px;font-size:11px;font-weight:600;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin-top:8px">${s.title}</div>
      ${s.items.map(i => `<div data-path="${i.path}" style="padding:5px 14px;font-size:13px;cursor:pointer;border-radius:4px;margin:0 4px;color:var(--color-text-primary);">${i.label}</div>`).join('')}
    `).join('');
  }

  destroy() {}
}
