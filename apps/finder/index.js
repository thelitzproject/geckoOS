/**
 * Finder — macOS-style file manager powered by GSL VFS
 */
export default class FinderApp {
  #kernel;
  #win;
  #cwd = '/home/user';
  #history  = ['/home/user'];
  #histIdx  = 0;
  #contentEl;
  #pathEl;
  #clipboard = null;  // { op: 'copy'|'cut', paths: string[] }

  constructor(kernel, win, args) {
    this.#kernel = kernel;
    this.#win    = win;
    if (args?.path) this.#cwd = args.path;
    win.setTitle('Finder');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;height:100%;background:var(--color-window-bg);';

    const sidebar = document.createElement('div');
    sidebar.className = 'finder-sidebar';
    sidebar.style.cssText = 'width:180px;flex-shrink:0;background:var(--color-sidebar-bg);border-right:0.5px solid var(--color-separator);overflow-y:auto;padding:8px 0;';
    sidebar.innerHTML = this._sidebarHTML();
    sidebar.querySelectorAll('[data-path]').forEach(item =>
      item.addEventListener('click', () => this._navigate(item.dataset.path))
    );

    const main = document.createElement('div');
    main.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
    main.appendChild(this._buildToolbar());

    this.#contentEl = document.createElement('div');
    this.#contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:12px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;';

    // Drop target for moving files into the current directory
    this.#contentEl.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/gecko-finder-path')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.#contentEl.style.outline = '2px dashed var(--color-accent)';
        this.#contentEl.style.outlineOffset = '-4px';
      }
    });
    this.#contentEl.addEventListener('dragleave', () => {
      this.#contentEl.style.outline = '';
      this.#contentEl.style.outlineOffset = '';
    });
    this.#contentEl.addEventListener('drop', async e => {
      this.#contentEl.style.outline = '';
      const srcPath = e.dataTransfer.getData('text/gecko-finder-path');
      if (!srcPath) return;
      e.preventDefault();
      const name = srcPath.split('/').pop();
      const dst  = `${this.#cwd}/${name}`;
      if (srcPath === dst) return;
      try {
        await this.#kernel.gsl.fs.rename(srcPath, dst);
        await this._refresh();
      } catch (err) {
        this.#kernel.notify('Finder', `Move failed: ${err.message}`);
      }
    });

    // Keyboard shortcuts
    container.setAttribute('tabindex', '-1');
    container.addEventListener('keydown', e => this._onKey(e));

    main.appendChild(this.#contentEl);
    container.append(sidebar, main);

    await this._navigate(this.#cwd);
  }

  _buildToolbar() {
    const tb = document.createElement('div');
    tb.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:0.5px solid var(--color-separator);flex-shrink:0;';

    const backBtn = this._tbBtn('←', () => this._goBack());
    const fwdBtn  = this._tbBtn('→', () => this._goForward());

    this.#pathEl = document.createElement('div');
    this.#pathEl.style.cssText = 'flex:1;font-size:12px;color:var(--color-text-secondary);padding:0 8px;';

    const newFolder = this._tbBtn('New Folder', async () => {
      const name = prompt('Folder name:');
      if (name?.trim()) {
        await this.#kernel.gsl.fs.mkdir(`${this.#cwd}/${name.trim()}`);
        await this._refresh();
      }
    });

    tb.append(backBtn, fwdBtn, this.#pathEl, newFolder);
    return tb;
  }

  _tbBtn(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:3px 10px;background:var(--color-surface-2);border:0.5px solid var(--color-border);border-radius:5px;font-size:12px;cursor:pointer;color:var(--color-text-primary);';
    btn.addEventListener('click', action);
    return btn;
  }

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

      await this._refresh();
    } catch (e) {
      this.#kernel.notify('Finder', `Cannot open: ${e.message}`);
    }
  }

  async _refresh() {
    this.#win.setTitle(`Finder — ${this.#cwd}`);
    if (this.#pathEl) this.#pathEl.textContent = this.#cwd;
    this.#contentEl.innerHTML = '';

    let entries;
    try { entries = await this.#kernel.gsl.fs.readdir(this.#cwd); }
    catch { return; }

    for (const name of entries.sort()) {
      const fullPath = `${this.#cwd}/${name}`;
      let stat;
      try { stat = await this.#kernel.gsl.fs.stat(fullPath); }
      catch { continue; }

      const item = this._buildFileItem(name, fullPath, stat);
      this.#contentEl.appendChild(item);
    }
  }

  _buildFileItem(name, fullPath, stat) {
    const isDir  = stat.type === 'dir';
    const item   = document.createElement('div');
    item.draggable = true;
    item.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;width:80px;cursor:pointer;border-radius:6px;transition:background 80ms;';

    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'font-size:32px;pointer-events:none;';
    iconEl.textContent = isDir ? '📁' : this._fileEmoji(name);

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'font-size:11px;text-align:center;word-break:break-all;max-width:72px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--color-text-primary);';
    labelEl.textContent = name;

    item.append(iconEl, labelEl);

    item.addEventListener('mouseenter', () => item.style.background = 'var(--color-sidebar-hover)');
    item.addEventListener('mouseleave', () => item.style.background = '');
    item.addEventListener('dblclick',  () => this._navigate(fullPath));

    // Drag source
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/gecko-finder-path', fullPath);
      e.dataTransfer.effectAllowed = 'move';
      item.style.opacity = '0.45';
    });
    item.addEventListener('dragend', () => { item.style.opacity = ''; });

    // Drop target (directories only)
    if (isDir) {
      item.addEventListener('dragover', e => {
        if (e.dataTransfer.types.includes('text/gecko-finder-path')) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          item.style.background = 'var(--color-accent-muted, rgba(0,122,255,0.2))';
        }
      });
      item.addEventListener('dragleave', () => { item.style.background = ''; });
      item.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        item.style.background = '';
        const srcPath = e.dataTransfer.getData('text/gecko-finder-path');
        if (!srcPath || srcPath === fullPath) return;
        const srcName = srcPath.split('/').pop();
        try {
          await this.#kernel.gsl.fs.rename(srcPath, `${fullPath}/${srcName}`);
          await this._refresh();
        } catch (err) {
          this.#kernel.notify('Finder', `Move failed: ${err.message}`);
        }
      });
    }

    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.#kernel.contextMenu.show(e.clientX, e.clientY, [
        { label: 'Open',   action: () => this._navigate(fullPath) },
        { label: 'Rename', action: () => this._rename(name, fullPath) },
        { separator: true },
        { label: 'Copy',   action: () => { this.#clipboard = { op: 'copy', paths: [fullPath] }; } },
        { label: 'Cut',    action: () => { this.#clipboard = { op: 'cut',  paths: [fullPath] }; } },
        { separator: true },
        { label: 'Move to Trash', action: () => this._trash(fullPath, stat.type) },
        { separator: true },
        { label: 'Get Info', action: () => this._showInfo(name, fullPath, stat) },
      ]);
    });

    return item;
  }

  _fileEmoji(name) {
    const ext = name.split('.').pop().toLowerCase();
    return { js:'📄', ts:'📄', json:'📋', txt:'📝', md:'📝', sh:'📄', html:'🌐', css:'🎨', png:'🖼', jpg:'🖼', jpeg:'🖼', svg:'🖼', mp3:'🎵', mp4:'🎬' }[ext] ?? '📄';
  }

  async _openFile(path) {
    const ext = path.split('.').pop().toLowerCase();
    if (['txt','md','json','js','ts','css','html','sh'].includes(ext)) {
      this.#kernel.openApp('textpad', { path });
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
    } catch (e) {
      this.#kernel.notify('Finder', `Cannot delete: ${e.message}`);
    }
  }

  // ── Get Info modal ────────────────────────────────────────────────────────

  _showInfo(name, fullPath, stat) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);';

    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:var(--color-window-bg)',
      'border:0.5px solid var(--color-border)',
      'border-radius:14px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)',
      'width:320px',
      'padding:20px 24px 24px',
      'font-size:13px',
      'color:var(--color-text-primary)',
    ].join(';');

    const isDir = stat.type === 'dir';
    const icon  = isDir ? '📁' : this._fileEmoji(name);
    const kind  = isDir ? 'Folder' : `${name.split('.').pop().toUpperCase()} File`;
    const size  = isDir ? '—' : this._fmtSize(stat.size ?? 0);
    const mtime = stat.mtime ? new Date(stat.mtime).toLocaleString() : '—';
    const ctime = stat.ctime ? new Date(stat.ctime).toLocaleString() : '—';
    const mode  = stat.mode ? stat.mode.toString(8) : '644';

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;border-bottom:0.5px solid var(--color-separator);padding-bottom:16px;">
        <span style="font-size:40px">${icon}</span>
        <div>
          <div style="font-weight:600;font-size:15px;word-break:break-all;">${name}</div>
          <div style="color:var(--color-text-secondary);font-size:12px;">${kind}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;line-height:1.8;">
        ${this._infoRow('Where', this._truncatePath(fullPath))}
        ${this._infoRow('Size', size)}
        ${this._infoRow('Kind', kind)}
        ${this._infoRow('Modified', mtime)}
        ${this._infoRow('Created', ctime)}
        ${this._infoRow('Permissions', mode)}
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

  _infoRow(label, value) {
    return `<tr>
      <td style="color:var(--color-text-secondary);padding-right:12px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="word-break:break-all;">${value}</td>
    </tr>`;
  }

  _fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  _truncatePath(p) {
    return p.length > 40 ? '…' + p.slice(-38) : p;
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  async _onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault();
      await this._paste();
    }
  }

  async _paste() {
    if (!this.#clipboard) return;
    const { op, paths } = this.#clipboard;
    for (const src of paths) {
      const name = src.split('/').pop();
      const dst  = `${this.#cwd}/${name}`;
      try {
        if (op === 'cut') {
          await this.#kernel.gsl.fs.rename(src, dst);
        } else {
          const content = await this.#kernel.gsl.fs.readFile(src, { encoding: 'binary' });
          await this.#kernel.gsl.fs.writeFile(dst, content);
        }
      } catch (err) {
        this.#kernel.notify('Finder', `Paste failed: ${err.message}`);
      }
    }
    if (op === 'cut') this.#clipboard = null;
    await this._refresh();
  }

  _goBack() {
    if (this.#histIdx > 0) {
      this.#histIdx--;
      this.#cwd = this.#history[this.#histIdx];
      this._refresh();
    }
  }

  _goForward() {
    if (this.#histIdx < this.#history.length - 1) {
      this.#histIdx++;
      this.#cwd = this.#history[this.#histIdx];
      this._refresh();
    }
  }

  _sidebarHTML() {
    const sections = [
      { title: 'Favourites', items: [
        { label: 'Home',      path: '/home/user' },
        { label: 'Desktop',   path: '/home/user/Desktop' },
        { label: 'Documents', path: '/home/user/Documents' },
        { label: 'Downloads', path: '/home/user/Downloads' },
      ]},
      { title: 'Locations', items: [
        { label: 'Root', path: '/' },
        { label: 'Etc',  path: '/etc' },
        { label: 'Tmp',  path: '/tmp' },
        { label: 'Usr',  path: '/usr' },
      ]},
    ];

    return sections.map(s => `
      <div style="padding:4px 12px;font-size:11px;font-weight:600;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin-top:8px">${s.title}</div>
      ${s.items.map(i => `<div data-path="${i.path}" style="padding:5px 16px;font-size:13px;cursor:pointer;border-radius:4px;margin:0 4px;color:var(--color-text-primary);">${i.label}</div>`).join('')}
    `).join('');
  }

  destroy() {}
}
