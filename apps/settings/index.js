/**
 * System Settings — geckoOS preferences
 */
export default class SettingsApp {
  #kernel;
  #win;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('System Settings');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;height:100%;background:var(--color-window-bg);';

    const sidebar = document.createElement('div');
    sidebar.style.cssText = 'width:220px;flex-shrink:0;background:var(--color-sidebar-bg);border-right:0.5px solid var(--color-separator);overflow-y:auto;padding:12px 0;';

    const content = document.createElement('div');
    content.style.cssText = 'flex:1;overflow-y:auto;padding:24px;';

    container.append(sidebar, content);

    const sections = [
      { id: 'appearance', label: 'Appearance',   icon: '' },
      { id: 'desktop',    label: 'Desktop',      icon: '' },
      { id: 'dock',       label: 'Dock',         icon: '' },
      { id: 'menubar',    label: 'Menu Bar',     icon: '' },
      { id: 'gsl',        label: 'GSL',          icon: '' },
      { id: 'about',      label: 'About',        icon: '' },
    ];

    sections.forEach(sec => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:8px 20px;font-size:13px;text-align:left;color:var(--color-text-primary);border-radius:0;transition:background 80ms;';
      btn.textContent = sec.label;
      btn.addEventListener('mouseenter', () => btn.style.background = 'var(--color-sidebar-hover)');
      btn.addEventListener('mouseleave', () => btn.style.background = '');
      btn.addEventListener('click', () => this._showSection(content, sec.id));
      sidebar.appendChild(btn);
    });

    this._showSection(content, 'appearance');
  }

  _showSection(el, id) {
    el.innerHTML = '';
    const h = document.createElement('h2');
    h.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:20px;color:var(--color-text-primary);';

    switch (id) {
      case 'appearance': this._buildAppearance(el); break;
      case 'desktop':    this._buildDesktop(el);    break;
      case 'dock':       this._buildDock(el);       break;
      case 'menubar':    this._buildMenuBar(el);    break;
      case 'gsl':        this._buildGSL(el);        break;
      case 'about':      this._buildAbout(el);      break;
    }
  }

  _row(label, control) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:0.5px solid var(--color-separator);';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size:13px;color:var(--color-text-primary);';
    row.append(lbl, control);
    return row;
  }

  _toggle(key) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.#kernel.settings.get(key);
    input.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--color-accent);';
    input.addEventListener('change', () => this.#kernel.settings.set(key, input.checked));
    return input;
  }

  _buildAppearance(el) {
    el.innerHTML = '<h2 style="font-size:18px;font-weight:600;margin-bottom:20px">Appearance</h2>';

    // Theme
    const sel = document.createElement('select');
    sel.style.cssText = 'padding:4px 8px;border-radius:5px;border:0.5px solid var(--color-border);background:var(--color-surface-1);font-size:13px;cursor:pointer;';
    ['light','dark'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (this.#kernel.settings.get('appearance.theme') === t) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => this.#kernel.settings.set('appearance.theme', sel.value));
    el.appendChild(this._row('Theme', sel));

    // Accent color
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = this.#kernel.settings.get('appearance.accentColor');
    colorPicker.style.cssText = 'width:40px;height:28px;border:none;cursor:pointer;border-radius:4px;';
    colorPicker.addEventListener('input', () => this.#kernel.settings.set('appearance.accentColor', colorPicker.value));
    el.appendChild(this._row('Accent Color', colorPicker));

    el.appendChild(this._row('Reduce Motion', this._toggle('accessibility.reduceMotion')));
  }

  _buildDesktop(el) {
    el.innerHTML = '<h2 style="font-size:18px;font-weight:600;margin-bottom:20px">Desktop & Wallpaper</h2>';

    const wallpapers = [
      { label: 'Default', url: 'assets/wallpapers/default.jpg' },
      { label: 'Dark',    url: 'assets/wallpapers/dark.jpg' },
      { label: 'Minimal', url: 'assets/wallpapers/minimal.jpg' },
    ];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;';

    wallpapers.forEach(w => {
      const thumb = document.createElement('div');
      thumb.style.cssText = `height:70px;border-radius:8px;background:url(${w.url}) center/cover;cursor:pointer;border:2px solid transparent;transition:border-color 100ms;`;
      thumb.addEventListener('click', () => {
        this.#kernel.desktop.setWallpaper(w.url);
        document.querySelectorAll('.wp-thumb').forEach(t => t.style.borderColor = 'transparent');
        thumb.style.borderColor = 'var(--color-accent)';
      });
      thumb.className = 'wp-thumb';
      const lbl = document.createElement('div');
      lbl.textContent = w.label;
      lbl.style.cssText = 'text-align:center;font-size:11px;margin-top:4px;color:var(--color-text-secondary);';
      const wrap = document.createElement('div');
      wrap.append(thumb, lbl);
      grid.appendChild(wrap);
    });

    el.appendChild(grid);
  }

  _buildDock(el) {
    el.innerHTML = '<h2 style="font-size:18px;font-weight:600;margin-bottom:20px">Dock</h2>';
    el.appendChild(this._row('Magnification', this._toggle('dock.magnification')));
    el.appendChild(this._row('Auto-hide', this._toggle('dock.autohide')));
  }

  _buildMenuBar(el) {
    el.innerHTML = '<h2 style="font-size:18px;font-weight:600;margin-bottom:20px">Menu Bar</h2>';
    el.appendChild(this._row('Use 24-hour clock', this._toggle('menubar.clock24h')));
    el.appendChild(this._row('Show date in clock', this._toggle('menubar.showDate')));
  }

  _buildGSL(el) {
    const gsl = this.#kernel.gsl;
    el.innerHTML = `
      <h2 style="font-size:18px;font-weight:600;margin-bottom:20px">Gecko Subsystem for Linux</h2>
      <div style="background:var(--color-surface-2);border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;">
          GSL provides a POSIX-compatible Linux environment running entirely in your browser.
          It includes a virtual filesystem (IndexedDB), bash-compatible shell, process manager,
          network layer, and APT package manager.
        </p>
      </div>
      <div style="font-size:13px;color:var(--color-text-primary);">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--color-surface-2);border-radius:6px;padding:12px;">
            <div style="font-weight:600">GSL Version</div>
            <div style="color:var(--color-text-secondary)">${gsl?.version ?? 'N/A'}</div>
          </div>
          <div style="background:var(--color-surface-2);border-radius:6px;padding:12px;">
            <div style="font-weight:600">Filesystem</div>
            <div style="color:var(--color-text-secondary)">IndexedDB VFS</div>
          </div>
          <div style="background:var(--color-surface-2);border-radius:6px;padding:12px;">
            <div style="font-weight:600">Shell</div>
            <div style="color:var(--color-text-secondary)">gsh (bash-compat)</div>
          </div>
          <div style="background:var(--color-surface-2);border-radius:6px;padding:12px;">
            <div style="font-weight:600">Package Manager</div>
            <div style="color:var(--color-text-secondary)">apt (Gecko Archive)</div>
          </div>
        </div>
      </div>`;
    el.appendChild(this._row('Enable GSL', this._toggle('gsl.enabled')));
  }

  _buildAbout(el) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:20px;">
        <img src="assets/icons/system/gecko-mark.svg" style="width:96px;height:96px;" />
        <h1 style="font-size:28px;font-weight:700">geckoOS</h1>
        <p style="color:var(--color-text-secondary)">Version 1.0.0 "Bijou"</p>
        <p style="color:var(--color-text-tertiary);font-size:12px">GSL v${this.#kernel.gsl?.version ?? '?'}</p>
        <p style="color:var(--color-text-tertiary);font-size:11px;max-width:320px;text-align:center;line-height:1.6">
          A browser-based desktop operating system with Mac-style UI and
          Gecko Subsystem for Linux.
        </p>
        <button onclick="navigator.clipboard.writeText('geckoOS 1.0.0 Bijou')" style="padding:6px 16px;background:var(--color-accent);color:#fff;border-radius:6px;border:none;cursor:pointer;font-size:13px;margin-top:8px;">
          Copy Version Info
        </button>
      </div>`;
  }

  destroy() {}
}
