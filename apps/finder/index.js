/**
 * Finder — macOS-style file manager powered by GSL VFS
 */
export default class FinderApp {
  #kernel;
  #win;
  #cwd = '/home/user';
  #history = ['/home/user'];
  #histIdx = 0;
  #contentEl;
  #pathEl;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('Finder');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;height:100%;background:var(--color-window-bg);';

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'finder-sidebar';
    sidebar.style.cssText = 'width:180px;flex-shrink:0;background:var(--color-sidebar-bg);border-right:0.5px solid var(--color-separator);overflow-y:auto;padding:8px 0;';
    sidebar.innerHTML = this._sidebarHTML();

    sidebar.querySelectorAll('[data-path]').forEach(item => {
      item.addEventListener('click', () => this._navigate(item.dataset.path));
    });

    // Main area
    const main = document.createElement('div');
    main.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

    // Toolbar
    const toolbar = this._buildToolbar();
    main.appendChild(toolbar);

    // Content
    this.#contentEl = document.createElement('div');
    this.#contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:12px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;';
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
      if (name) {
        await this.#kernel.gsl.fs.mkdir(`${this.#cwd}/${name}`);
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
      if (this.#histIdx < this.#history.length - 1) {
        this.#history = this.#history.slice(0, this.#histIdx + 1);
      }
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
    try {
      entries = await this.#kernel.gsl.fs.readdir(this.#cwd);
    } catch {
      return;
    }

    for (const name of entries.sort()) {
      const fullPath = `${this.#cwd}/${name}`;
      let type = 'file';
      try {
        const stat = await this.#kernel.gsl.fs.stat(fullPath);
        type = stat.type;
      } catch {}

      const item = document.createElement('div');
      item.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;width:80px;cursor:pointer;border-radius:6px;transition:background 80ms;';
      item.innerHTML = `
        <div style="font-size:32px">${type === 'dir' ? '□' : this._fileIcon(name)}</div>
        <span style="font-size:11px;text-align:center;word-break:break-all;max-width:72px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${name}</span>`;

      item.addEventListener('mouseenter', () => item.style.background = 'var(--color-sidebar-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('dblclick',  () => this._navigate(fullPath));
      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        this.#kernel.contextMenu.show(e.clientX, e.clientY, [
          { label: 'Open',   action: () => this._navigate(fullPath) },
          { label: 'Rename', action: () => this._rename(name, fullPath) },
          { separator: true },
          { label: 'Move to Trash', action: () => this._trash(fullPath, type) },
          { label: 'Get Info', action: () => this._info(fullPath) },
        ]);
      });

      this.#contentEl.appendChild(item);
    }
  }

  _fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    return { js:'▤', ts:'▤', json:'▤', txt:'▪', md:'▪', sh:'▤', html:'▤', css:'▤', png:'▭', jpg:'▭', svg:'▭', mp3:'▷', mp4:'▷' }[ext] ?? '▪';
  }

  async _openFile(path) {
    const ext = path.split('.').pop().toLowerCase();
    if (['txt','md','json','js','css','html','sh'].includes(ext)) {
      this.#kernel.openApp('textpad', { path });
    } else {
      this.#kernel.notify('Finder', `Cannot open: ${path.split('/').pop()}`);
    }
  }

  async _rename(oldName, fullPath) {
    const newName = prompt('New name:', oldName);
    if (newName && newName !== oldName) {
      await this.#kernel.gsl.fs.rename(fullPath, `${this.#cwd}/${newName}`);
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

  _info(path) {
    this.#kernel.notify('Finder', `Path: ${path}`);
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
