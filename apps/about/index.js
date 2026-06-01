/**
 * About geckoOS — system information app.
 * Styled after macOS "About This Mac" with tabbed panels.
 */
export default class AboutApp {
  #kernel;
  #win;
  #activeTab = 'overview';

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('About geckoOS');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:var(--color-window-bg);overflow:hidden;';

    // ── Hero ───────────────────────────────────────────────────────────────
    const hero = document.createElement('div');
    hero.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:center',
      'padding:28px 24px 20px', 'gap:10px',
      'background:linear-gradient(180deg,var(--color-surface-2) 0%,var(--color-window-bg) 100%)',
      'border-bottom:0.5px solid var(--color-separator)', 'flex-shrink:0',
    ].join(';');

    const logo = document.createElement('img');
    logo.src   = 'assets/icons/system/gecko-mark.svg';
    logo.alt   = 'geckoOS';
    logo.style.cssText = 'width:72px;height:72px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.18));';

    const name = document.createElement('h1');
    name.textContent = 'geckoOS';
    name.style.cssText = 'font-size:22px;font-weight:700;color:var(--color-text-primary);letter-spacing:-0.3px;';

    const badge = document.createElement('div');
    badge.style.cssText = 'display:flex;align-items:center;gap:8px;';
    badge.innerHTML = `
      <span style="font-size:13px;color:var(--color-text-secondary);">Version 1.0.0 "Bijou"</span>
      <span style="font-size:11px;padding:1px 7px;background:var(--color-accent);color:#fff;border-radius:10px;font-weight:600;">RELEASE</span>`;

    hero.append(logo, name, badge);

    // ── Tab bar ────────────────────────────────────────────────────────────
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;justify-content:center;gap:2px;padding:10px 20px 0;background:var(--color-window-bg);flex-shrink:0;border-bottom:0.5px solid var(--color-separator);';

    const TABS = [
      { id: 'overview',  label: 'Overview' },
      { id: 'gsl',       label: 'GSL' },
      { id: 'storage',   label: 'Storage' },
      { id: 'display',   label: 'Display' },
      { id: 'legal',     label: 'Legal' },
    ];

    const tabEls = {};
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.dataset.tab = tab.id;
      btn.style.cssText = [
        'padding:6px 16px 8px', 'font-size:13px', 'border:none', 'background:none',
        'cursor:pointer', 'color:var(--color-text-secondary)',
        'border-bottom:2px solid transparent', 'margin-bottom:-1px',
        'transition:color 80ms,border-color 80ms',
      ].join(';');
      btn.addEventListener('click', () => this._switchTab(tab.id, tabEls, content));
      tabBar.appendChild(btn);
      tabEls[tab.id] = btn;
    }

    // ── Content panel ──────────────────────────────────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'flex:1;overflow-y:auto;padding:24px 32px;';

    container.append(hero, tabBar, content);

    this._switchTab('overview', tabEls, content);
  }

  _switchTab(id, tabEls, content) {
    this.#activeTab = id;

    for (const [tid, el] of Object.entries(tabEls)) {
      const active = tid === id;
      el.style.color = active ? 'var(--color-accent)' : 'var(--color-text-secondary)';
      el.style.borderBottomColor = active ? 'var(--color-accent)' : 'transparent';
      el.style.fontWeight = active ? '600' : '400';
    }

    content.innerHTML = '';
    const render = {
      overview: () => this._renderOverview(content),
      gsl:      () => this._renderGSL(content),
      storage:  () => this._renderStorage(content),
      display:  () => this._renderDisplay(content),
      legal:    () => this._renderLegal(content),
    };
    render[id]?.();
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  _renderOverview(el) {
    const ua  = navigator.userAgent;
    const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown';
    const cores = navigator.hardwareConcurrency ?? 'Unknown';
    const lang  = navigator.language;
    const online = navigator.onLine ? 'Connected' : 'Offline';

    const rows = [
      { label: 'geckoOS',         value: '1.0.0 "Bijou"' },
      { label: 'GSL',             value: `v${this.#kernel.gsl?.version ?? '?'} (Gecko Subsystem for Linux)` },
      { label: 'Kernel',          value: 'geckok 1.00' },
      { label: 'Shell',           value: 'gsh 1.0' },
      { separator: true },
      { label: 'Browser Engine',  value: this._detectEngine(ua) },
      { label: 'Platform',        value: this._detectPlatform(ua) },
      { label: 'Language',        value: lang },
      { separator: true },
      { label: 'Logical CPUs',    value: String(cores) },
      { label: 'Device Memory',   value: mem },
      { label: 'Network',         value: online },
      { separator: true },
      { label: 'Window Manager',  value: 'geckodesk 1.00' },
      { label: 'Compositor',      value: 'geckoUI 1.01' },
      { label: 'Package Manager', value: 'apt for geckoOS' },
    ];

    el.appendChild(this._table(rows));

    // Software update stub
    const updateBox = document.createElement('div');
    updateBox.style.cssText = 'margin-top:20px;padding:14px 16px;background:var(--color-surface-2);border-radius:10px;display:flex;align-items:center;gap:12px;';
    updateBox.innerHTML = `
      <span style="font-size:24px">✅</span>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--color-text-primary)">geckoOS is up to date</div>
        <div style="font-size:12px;color:var(--color-text-secondary)">geckoOS 1.0.0 is the latest release.</div>
      </div>`;
    el.appendChild(updateBox);
  }
  
  _renderGSL(el) {
    const gsl = this.#kernel.gsl;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:20px;padding:16px;background:var(--color-surface-2);border-radius:12px;';
    header.innerHTML = `
      <span style="font-size:40px">🐧</span>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--color-text-primary)">Gecko Subsystem for Linux</div>
        <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">Version ${gsl?.version ?? '?'} · POSIX-compatible browser environment</div>
      </div>`;
    el.appendChild(header);

    const rows = [
      { label: 'Status',          value: gsl ? '🟢 Running' : '🔴 Disabled' },
      { label: 'Version',         value: gsl?.version ?? 'N/A' },
      { separator: true },
      { label: 'Filesystem',      value: 'geckoVFS (IndexedDB-backed, POSIX)' },
      { label: 'Shell',           value: 'gsh — bash-compatible interpreter' },
      { label: 'Shell builtins',  value: '30+ commands (ls, cat, grep, apt…)' },
      { label: 'Network',         value: 'geckoNet (fetch-based curl/wget)' },
      { label: 'Syscall table',   value: 'POSIX-compatible (open/read/write/stat…)' },
      { separator: true },
      { label: 'Package Manager', value: 'APT (Gecko Package Archive)' },
      { label: 'Init system',     value: 'geckoInit 1.0' },
      { label: 'Root FS',         value: 'Provisioned at /  (first boot)' },
    ];

    el.appendChild(this._table(rows));

    const openTermBtn = document.createElement('button');
    openTermBtn.textContent = 'Open Terminal';
    openTermBtn.style.cssText = 'margin-top:18px;padding:8px 20px;background:var(--color-accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;';
    openTermBtn.addEventListener('click', () => this.#kernel.openApp('terminal'));
    el.appendChild(openTermBtn);
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  async _renderStorage(el) {
    el.innerHTML = '<div style="color:var(--color-text-tertiary);font-size:13px">Loading storage info…</div>';

    let quota = null, usage = null;
    try {
      const est = await navigator.storage?.estimate?.();
      quota = est?.quota;
      usage = est?.usage;
    } catch {}

    const vfsUsage = await this._estimateVFSUsage();

    el.innerHTML = '';

    // Bar chart
    if (quota && usage !== null) {
      const pct = Math.min(100, (usage / quota) * 100).toFixed(1);
      const bar = document.createElement('div');
      bar.style.cssText = 'margin-bottom:20px;';
      bar.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-secondary);margin-bottom:6px;">
          <span>Browser Storage</span>
          <span>${this._fmtBytes(usage)} of ${this._fmtBytes(quota)}</span>
        </div>
        <div style="height:8px;background:var(--color-surface-3);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--color-accent);border-radius:4px;transition:width 600ms var(--transition-slow);"></div>
        </div>
        <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px;">${pct}% used</div>`;
      el.appendChild(bar);
    }

    const rows = [
      { label: 'VFS (IndexedDB)',     value: this._fmtBytes(vfsUsage) },
      { label: 'Settings',            value: this._fmtBytes(new Blob([localStorage.getItem('geckoOS.settings') ?? '']).size) },
      { label: 'Installed Apps',      value: this._fmtBytes(new Blob([localStorage.getItem('geckoOS.installedApps') ?? '']).size) },
      { label: 'APT Cache',           value: this._fmtBytes(new Blob([localStorage.getItem('geckoOS.apt.installed') ?? '']).size) },
      { separator: true },
      { label: 'Total Browser Quota', value: quota ? this._fmtBytes(quota) : 'Unknown' },
      { label: 'Total Used',          value: usage !== null ? this._fmtBytes(usage) : 'Unknown' },
      { label: 'Available',           value: quota && usage !== null ? this._fmtBytes(quota - usage) : 'Unknown' },
    ];

    el.appendChild(this._table(rows));

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear VFS Data…';
    clearBtn.style.cssText = 'margin-top:18px;padding:7px 16px;background:var(--color-error);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;';
    clearBtn.addEventListener('click', () => {
      if (confirm('Delete all GSL filesystem data? This cannot be undone.')) {
        indexedDB.deleteDatabase('geckoOS.gsl.fs');
        this.#kernel.notify('About', 'GSL filesystem cleared. Restart to re-provision.');
      }
    });
    el.appendChild(clearBtn);
  }

  async _estimateVFSUsage() {
    try {
      const dbs = await indexedDB.databases?.();
      if (!dbs) return 0;
      // Rough estimate: sum of all IDB keys
      return 0; // accurate IDB size isn't exposed; show 0 rather than lie
    } catch { return 0; }
  }

  // ── Display ───────────────────────────────────────────────────────────────
  _renderDisplay(el) {
    const w  = window.screen.width;
    const h  = window.screen.height;
    const dw = window.innerWidth;
    const dh = window.innerHeight;
    const dpr = window.devicePixelRatio ?? 1;
    const depth = window.screen.colorDepth ?? 24;
    const orientation = screen.orientation?.type ?? 'unknown';

    const rows = [
      { label: 'Resolution',          value: `${w} × ${h}` },
      { label: 'geckoOS Window',       value: `${dw} × ${dh}` },
      { label: 'Device Pixel Ratio',   value: `${dpr}× (${Math.round(dpr * 96)} DPI)` },
      { label: 'Color Depth',          value: `${depth}-bit` },
      { label: 'Orientation',          value: orientation },
      { separator: true },
      { label: 'Theme',                value: this.#kernel.settings.get('appearance.theme') },
      { label: 'Accent Color',         value: this._colorSwatch(this.#kernel.settings.get('appearance.accentColor')) },
      { label: 'Reduce Motion',        value: this.#kernel.settings.get('accessibility.reduceMotion') ? 'On' : 'Off' },
      { separator: true },
      { label: 'Renderer',             value: this._detectRenderer() },
      { label: 'Backdrop Blur',        value: CSS.supports('backdrop-filter','blur(1px)') ? 'Supported' : 'Not supported' },
    ];

    el.appendChild(this._table(rows));
  }

  // ── Legal ─────────────────────────────────────────────────────────────────
  _renderLegal(el) {
    el.innerHTML = `
      <div style="max-width:520px;">
        <h2 style="font-size:15px;font-weight:600;color:var(--color-text-primary);margin-bottom:12px;">License</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);line-height:1.65;margin-bottom:16px;">
          geckoOS is released under the <strong style="color:var(--color-text-primary)">MIT License</strong>.
          Copyright © 2024–${new Date().getFullYear()} the geckoOS contributors.
        </p>
        <p style="font-size:13px;color:var(--color-text-secondary);line-height:1.65;margin-bottom:20px;">
          Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
        </p>

        <h2 style="font-size:15px;font-weight:600;color:var(--color-text-primary);margin-bottom:12px;">Open Source Components</h2>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${[
            ['geckoOS core',        'MIT',    '1.0.0'],
            ['GSL (gecko subsystem)','MIT',   '1.0.0'],
            ['geckoVFS',            'MIT',    '1.0.0'],
            ['gsh (shell)',         'MIT',    '1.0.0'],
            ['geckoAPT',            'MIT',    '1.0.0'],
          ].map(([name, lic, ver]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-surface-2);border-radius:7px;">
              <span style="font-size:13px;color:var(--color-text-primary);font-weight:500;">${name}</span>
              <span style="font-size:12px;color:var(--color-text-tertiary);">${lic} · ${ver}</span>
            </div>`).join('')}
        </div>

        <p style="font-size:11px;color:var(--color-text-tertiary);margin-top:20px;line-height:1.5;">
          geckoOS and GSL are not affiliated with, endorsed by, or related to Apple Inc., Microsoft Corporation, or the Linux Foundation. "Mac-style" refers to visual design inspiration only.
        </p>
      </div>`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _table(rows) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;background:var(--color-surface-2);border-radius:12px;overflow:hidden;';

    for (const row of rows) {
      if (row.separator) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:0.5px;background:var(--color-separator);margin:0 12px;';
        wrap.appendChild(sep);
        continue;
      }
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;gap:16px;';

      const lbl = document.createElement('span');
      lbl.textContent = row.label;
      lbl.style.cssText = 'font-size:13px;color:var(--color-text-secondary);white-space:nowrap;flex-shrink:0;';

      const val = document.createElement('span');
      if (typeof row.value === 'string') {
        val.textContent = row.value;
      } else {
        val.appendChild(row.value); // DOM node (e.g. color swatch)
      }
      val.style.cssText = 'font-size:13px;color:var(--color-text-primary);text-align:right;';

      r.append(lbl, val);
      wrap.appendChild(r);
    }
    return wrap;
  }

  _colorSwatch(hex) {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${hex};border:1px solid rgba(0,0,0,0.1);`;
    const lbl = document.createElement('span');
    lbl.textContent = hex;
    wrap.append(dot, lbl);
    return wrap;
  }

  _detectEngine(ua) {
    if (ua.includes('Firefox'))   return 'Gecko (Mozilla Firefox)';
    if (ua.includes('Edg/'))      return 'Blink (Microsoft Edge)';
    if (ua.includes('OPR/'))      return 'Blink (Opera)';
    if (ua.includes('Chrome'))    return 'Blink (Chromium)';
    if (ua.includes('Safari'))    return 'WebKit (Apple Safari)';
    return 'Unknown';
  }

  _detectPlatform(ua) {
    if (ua.includes('Win'))    return 'Windows';
    if (ua.includes('Mac'))    return 'macOS';
    if (ua.includes('Linux'))  return 'Linux';
    if (ua.includes('Android'))return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  _detectRenderer() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'Software (no WebGL)';
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'WebGL (renderer masked)';
    } catch { return 'Unknown'; }
  }

  _fmtBytes(b) {
    if (!b) return '0 B';
    const units = ['B','KB','MB','GB'];
    let i = 0;
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  destroy() {}
}
