/**
 * System Settings — geckoOS preferences
 */
export default class SettingsApp {
  #kernel;
  #win;
  #sidebarBtns = new Map();
  #contentEl;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('System Settings');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;height:100%;background:var(--color-window-bg);';

    const sidebar = document.createElement('div');
    sidebar.style.cssText = 'width:220px;flex-shrink:0;background:var(--color-sidebar-bg);border-right:0.5px solid var(--color-separator);overflow-y:auto;padding:12px 0;';

    this.#contentEl = document.createElement('div');
    this.#contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:28px 32px;';

    container.append(sidebar, this.#contentEl);

    const sections = [
      { id: 'general',        label: 'General',           icon: '⚙️' },
      { id: 'appearance',     label: 'Appearance',        icon: '🎨' },
      { id: 'desktop',        label: 'Desktop',           icon: '🖥️' },
      { id: 'dock',           label: 'Dock',              icon: '📌' },
      { id: 'menubar',        label: 'Menu Bar',          icon: '📊' },
      { id: 'notifications',  label: 'Notifications',     icon: '🔔' },
      { id: 'accessibility',  label: 'Accessibility',     icon: '♿' },
      { id: 'privacy',        label: 'Privacy & Security',icon: '🔒' },
      { id: 'gsl',            label: 'GSL',               icon: '🐧' },
    ];

    // Group separator before GSL
    const groups = [
      { ids: ['general','appearance','desktop','dock','menubar','notifications','accessibility','privacy'] },
      { ids: ['gsl'] },
    ];

    let allSections = [];
    groups.forEach((g, gi) => {
      g.ids.forEach(id => allSections.push({ ...sections.find(s => s.id === id), group: gi }));
    });

    let lastGroup = -1;
    for (const sec of allSections) {
      if (sec.group !== lastGroup && lastGroup !== -1) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:0.5px;background:var(--color-separator);margin:6px 16px;';
        sidebar.appendChild(sep);
      }
      lastGroup = sec.group;

      const btn = document.createElement('button');
      btn.style.cssText = [
        'display:flex', 'align-items:center', 'gap:10px',
        'width:100%', 'padding:8px 16px',
        'font-size:13px', 'text-align:left',
        'color:var(--color-text-primary)',
        'border:none', 'background:none',
        'border-radius:6px', 'margin:0 4px',
        'cursor:pointer',
        'transition:background 80ms',
        'width:calc(100% - 8px)',
      ].join(';');

      const iconEl = document.createElement('span');
      iconEl.textContent = sec.icon;
      iconEl.style.cssText = 'font-size:14px;width:18px;text-align:center;flex-shrink:0;';

      const labelEl = document.createElement('span');
      labelEl.textContent = sec.label;

      btn.append(iconEl, labelEl);
      btn.addEventListener('mouseenter', () => { if (!btn.dataset.active) btn.style.background = 'var(--color-sidebar-hover)'; });
      btn.addEventListener('mouseleave', () => { if (!btn.dataset.active) btn.style.background = ''; });
      btn.addEventListener('click', () => this._showSection(sec.id));
      sidebar.appendChild(btn);
      this.#sidebarBtns.set(sec.id, btn);
    }

    this._showSection('general');
  }

  _showSection(id) {
    this.#sidebarBtns.forEach((btn, bid) => {
      const active = bid === id;
      btn.dataset.active = active ? '1' : '';
      btn.style.background = active ? 'var(--color-accent)' : '';
      btn.style.color = active ? '#fff' : 'var(--color-text-primary)';
    });

    this.#contentEl.innerHTML = '';
    const builders = {
      general:       () => this._buildGeneral(),
      appearance:    () => this._buildAppearance(),
      desktop:       () => this._buildDesktop(),
      dock:          () => this._buildDock(),
      menubar:       () => this._buildMenuBar(),
      notifications: () => this._buildNotifications(),
      accessibility: () => this._buildAccessibility(),
      privacy:       () => this._buildPrivacy(),
      gsl:           () => this._buildGSL(),
    };
    builders[id]?.();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _h(text) {
    const h = document.createElement('h2');
    h.textContent = text;
    h.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:20px;color:var(--color-text-primary);';
    this.#contentEl.appendChild(h);
  }

  _subh(text) {
    const h = document.createElement('h3');
    h.textContent = text;
    h.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px;';
    this.#contentEl.appendChild(h);
  }

  _card() {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--color-surface-2);border-radius:12px;overflow:hidden;margin-bottom:16px;';
    this.#contentEl.appendChild(card);
    return card;
  }

  _row(card, label, control, description) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:0.5px solid var(--color-separator);gap:16px;';
    row.style.cssText += 'border-bottom:0.5px solid var(--color-separator);';
    // Remove bottom border from last child via JS after all rows added
    const left = document.createElement('div');
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size:13px;color:var(--color-text-primary);display:block;';
    left.appendChild(lbl);
    if (description) {
      const desc = document.createElement('span');
      desc.textContent = description;
      desc.style.cssText = 'font-size:11px;color:var(--color-text-tertiary);display:block;margin-top:1px;';
      left.appendChild(desc);
    }
    row.append(left, control);
    card.appendChild(row);
    // Remove separator from last row when siblings update
    const updateBorders = () => {
      const rows = card.querySelectorAll('div[style*="border-bottom"]');
      rows.forEach((r, i) => { r.style.borderBottom = i === rows.length - 1 ? 'none' : '0.5px solid var(--color-separator)'; });
    };
    requestAnimationFrame(updateBorders);
    return row;
  }

  _toggle(key, onChange) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.#kernel.settings.get(key);
    input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';
    const slider = document.createElement('span');
    slider.style.cssText = [
      'position:absolute', 'cursor:pointer', 'inset:0',
      'border-radius:20px', 'transition:background 200ms',
      `background:${input.checked ? 'var(--color-accent)' : 'var(--color-surface-3)'}`,
    ].join(';');
    const knob = document.createElement('span');
    knob.style.cssText = [
      'position:absolute', 'height:16px', 'width:16px',
      'border-radius:50%', 'background:#fff',
      'bottom:2px', 'transition:transform 200ms,left 200ms',
      `left:${input.checked ? '18px' : '2px'}`,
      'box-shadow:0 1px 3px rgba(0,0,0,0.3)',
    ].join(';');
    slider.appendChild(knob);
    wrap.append(input, slider);
    input.addEventListener('change', () => {
      slider.style.background = input.checked ? 'var(--color-accent)' : 'var(--color-surface-3)';
      knob.style.left = input.checked ? '18px' : '2px';
      this.#kernel.settings.set(key, input.checked);
      onChange?.(input.checked);
    });
    return wrap;
  }

  _select(key, options) {
    const sel = document.createElement('select');
    sel.style.cssText = 'padding:4px 8px;border-radius:6px;border:0.5px solid var(--color-border);background:var(--color-surface-1);font-size:13px;cursor:pointer;color:var(--color-text-primary);';
    options.forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (this.#kernel.settings.get(key) === val) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => this.#kernel.settings.set(key, sel.value));
    return sel;
  }

  _slider(key, min, max, step, fmt) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = this.#kernel.settings.get(key) ?? min;
    input.style.cssText = 'width:100px;accent-color:var(--color-accent);cursor:pointer;';
    const val = document.createElement('span');
    val.style.cssText = 'font-size:12px;color:var(--color-text-secondary);width:32px;text-align:right;';
    val.textContent = fmt ? fmt(input.value) : input.value;
    input.addEventListener('input', () => {
      this.#kernel.settings.set(key, Number(input.value));
      val.textContent = fmt ? fmt(input.value) : input.value;
    });
    wrap.append(input, val);
    return wrap;
  }

  // ── Sections ─────────────────────────────────────────────────────────────

  _buildGeneral() {
    this._h('General');

    // User
    this._subh('User');
    const userCard = this._card();
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = this.#kernel.settings.get('user.name', 'User');
    nameInput.placeholder = 'Your name';
    nameInput.style.cssText = 'padding:4px 8px;border-radius:6px;border:0.5px solid var(--color-border);background:var(--color-surface-1);font-size:13px;color:var(--color-text-primary);width:160px;';
    nameInput.addEventListener('change', () => this.#kernel.settings.set('user.name', nameInput.value.trim() || 'User'));
    this._row(userCard, 'Full Name', nameInput);

    const langSel = this._select('general.language', [['en-US','English (US)'],['en-GB','English (UK)'],['es','Español'],['fr','Français'],['de','Deutsch'],['ja','日本語']]);
    this._row(userCard, 'Language', langSel, 'Display language (UI restart may be needed)');

    // Startup apps
    this._subh('Startup');
    const startCard = this._card();
    const startupApps = this.#kernel.settings.get('startup.apps', []);
    const appList = this.#kernel.apps.all().filter(a => !['about'].includes(a.id));
    for (const app of appList) {
      const tog = this._toggle_raw(startupApps.includes(app.id), checked => {
        const current = this.#kernel.settings.get('startup.apps', []);
        const next = checked
          ? [...new Set([...current, app.id])]
          : current.filter(id => id !== app.id);
        this.#kernel.settings.set('startup.apps', next);
      });
      this._row(startCard, app.name, tog, `Launch ${app.name} at boot`);
    }

    // System
    this._subh('System');
    const sysCard = this._card();
    this._row(sysCard, 'Auto-save settings', this._toggle('general.autosave'));
    this._row(sysCard, 'Show boot splash', this._toggle('general.bootSplash'));
  }

  _toggle_raw(checked, onChange) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';
    const slider = document.createElement('span');
    slider.style.cssText = [
      'position:absolute', 'cursor:pointer', 'inset:0',
      'border-radius:20px', 'transition:background 200ms',
      `background:${checked ? 'var(--color-accent)' : 'var(--color-surface-3)'}`,
    ].join(';');
    const knob = document.createElement('span');
    knob.style.cssText = [
      'position:absolute', 'height:16px', 'width:16px',
      'border-radius:50%', 'background:#fff',
      'bottom:2px', 'transition:left 200ms',
      `left:${checked ? '18px' : '2px'}`,
      'box-shadow:0 1px 3px rgba(0,0,0,0.3)',
    ].join(';');
    slider.appendChild(knob);
    wrap.append(input, slider);
    input.addEventListener('change', () => {
      slider.style.background = input.checked ? 'var(--color-accent)' : 'var(--color-surface-3)';
      knob.style.left = input.checked ? '18px' : '2px';
      onChange?.(input.checked);
    });
    return wrap;
  }

  _buildAppearance() {
    this._h('Appearance');

    this._subh('Theme');
    const themeCard = this._card();
    this._row(themeCard, 'Theme', this._select('appearance.theme', [['light','Light'],['dark','Dark'],['sunset','Sunset']]));

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = this.#kernel.settings.get('appearance.accentColor', '#007aff');
    colorPicker.style.cssText = 'width:40px;height:28px;border:none;cursor:pointer;border-radius:4px;background:none;';
    colorPicker.addEventListener('input', () => this.#kernel.settings.set('appearance.accentColor', colorPicker.value));
    this._row(themeCard, 'Accent Color', colorPicker);

    // Accent presets
    const presets = ['#007aff','#34c759','#ff9f0a','#ff3b30','#af52de','#ff2d55','#5ac8fa','#00c7be'];
    const swatchWrap = document.createElement('div');
    swatchWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    presets.forEach(hex => {
      const s = document.createElement('button');
      s.style.cssText = `width:22px;height:22px;border-radius:50%;background:${hex};border:2px solid transparent;cursor:pointer;transition:border-color 80ms;`;
      s.addEventListener('click', () => {
        colorPicker.value = hex;
        this.#kernel.settings.set('appearance.accentColor', hex);
        swatchWrap.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
        s.style.borderColor = '#fff';
      });
      swatchWrap.appendChild(s);
    });
    const swatchRow = document.createElement('div');
    swatchRow.style.cssText = 'padding:10px 16px;border-top:0.5px solid var(--color-separator);';
    swatchRow.appendChild(swatchWrap);
    themeCard.appendChild(swatchRow);

    this._subh('Text');
    const textCard = this._card();
    this._row(textCard, 'Font Size', this._slider('appearance.fontSize', 11, 18, 1, v => `${v}px`), 'Base interface font size');
    this._row(textCard, 'Font Family', this._select('appearance.fontFamily', [
      ['system-ui','System Default'],
      ['"SF Pro Display",system-ui','SF Pro'],
      ['"Segoe UI",system-ui','Segoe UI'],
      ['Georgia,serif','Georgia'],
    ]));

    this._subh('Motion');
    const motionCard = this._card();
    this._row(motionCard, 'Reduce Motion', this._toggle('accessibility.reduceMotion'), 'Minimize animations and transitions');
    this._row(motionCard, 'Window Animations', this._toggle('appearance.windowAnimations', true));
  }

  _buildDesktop() {
    this._h('Desktop & Wallpaper');

    this._subh('Wallpaper');
    const wallpapers = [
      { label: 'Default', url: 'assets/wallpapers/default.jpg' },
      { label: 'Dark',    url: 'assets/wallpapers/dark.jpg' },
      { label: 'Minimal', url: 'assets/wallpapers/minimal.jpg' },
    ];
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;';
    wallpapers.forEach(w => {
      const thumb = document.createElement('div');
      thumb.className = 'wp-thumb';
      const currentWp = this.#kernel.settings.get('desktop.wallpaper', '');
      thumb.style.cssText = `height:80px;border-radius:10px;background:url(${w.url}) center/cover,var(--color-surface-2);cursor:pointer;border:2.5px solid ${currentWp === w.url ? 'var(--color-accent)' : 'transparent'};transition:border-color 100ms;`;
      thumb.addEventListener('click', () => {
        this.#kernel.desktop.setWallpaper(w.url);
        document.querySelectorAll('.wp-thumb').forEach(t => t.style.borderColor = 'transparent');
        thumb.style.borderColor = 'var(--color-accent)';
      });
      const lbl = document.createElement('div');
      lbl.textContent = w.label;
      lbl.style.cssText = 'text-align:center;font-size:11px;margin-top:5px;color:var(--color-text-secondary);';
      const wrap = document.createElement('div');
      wrap.append(thumb, lbl);
      grid.appendChild(wrap);
    });
    this.#contentEl.appendChild(grid);

    this._subh('Desktop Icons');
    const iconsCard = this._card();
    this._row(iconsCard, 'Show Desktop Icons', this._toggle('desktop.showIcons', true));
    this._row(iconsCard, 'Icon Size', this._slider('desktop.iconSize', 40, 80, 4, v => `${v}px`));
    this._row(iconsCard, 'Icon Labels', this._toggle('desktop.showIconLabels', true));
  }

  _buildDock() {
    this._h('Dock');

    const card = this._card();
    this._row(card, 'Magnification', this._toggle('dock.magnification'), 'Enlarge icons on hover');
    this._row(card, 'Auto-hide', this._toggle('dock.autohide'), 'Hide dock when not in use');
    this._row(card, 'Show running indicator', this._toggle('dock.showDot', true));

    this._subh('Size');
    const sizeCard = this._card();
    this._row(sizeCard, 'Icon Size', this._slider('dock.iconSize', 32, 64, 4, v => `${v}px`));
  }

  _buildMenuBar() {
    this._h('Menu Bar');

    const card = this._card();
    this._row(card, 'Use 24-hour clock', this._toggle('menubar.clock24h'));
    this._row(card, 'Show date in clock', this._toggle('menubar.showDate'));
    this._row(card, 'Show seconds', this._toggle('menubar.showSeconds'));

    this._subh('Items');
    const itemsCard = this._card();
    this._row(itemsCard, 'Show Battery indicator',   this._toggle('menubar.showBattery'));
    this._row(itemsCard, 'Show Network indicator',   this._toggle('menubar.showNetwork'));
    this._row(itemsCard, 'Show Bluetooth indicator', this._toggle('menubar.showBluetooth'));
  }

  _buildNotifications() {
    this._h('Notifications');

    const card = this._card();
    this._row(card, 'Enable Notifications', this._toggle('notifications.enabled', true), 'Show system and app notifications');
    this._row(card, 'Notification Sound', this._toggle('notifications.sound', false));
    this._row(card, 'Do Not Disturb', this._toggle('notifications.dnd', false), 'Silence all notifications');

    this._subh('Duration');
    const durCard = this._card();
    this._row(durCard, 'Auto-dismiss after', this._select('notifications.duration', [
      ['3000','3 seconds'],
      ['5000','5 seconds'],
      ['8000','8 seconds'],
      ['0','Never'],
    ]));

    this._subh('Per-App');
    const appCard = this._card();
    const notifApps = this.#kernel.apps.all().filter(a => !['about'].includes(a.id));
    for (const app of notifApps) {
      this._row(appCard, app.name, this._toggle(`notifications.app.${app.id}`, true));
    }
  }

  _buildAccessibility() {
    this._h('Accessibility');

    this._subh('Vision');
    const visionCard = this._card();
    this._row(visionCard, 'Increase Contrast', this._toggle('accessibility.highContrast'), 'Increase color contrast throughout the UI');
    this._row(visionCard, 'Bold Text', this._toggle('accessibility.boldText'));
    this._row(visionCard, 'Reduce Transparency', this._toggle('accessibility.reduceTransparency'), 'Replace translucent surfaces with opaque ones');

    this._subh('Motion');
    const motionCard = this._card();
    this._row(motionCard, 'Reduce Motion', this._toggle('accessibility.reduceMotion'), 'Minimize animations throughout the UI');

    this._subh('Input');
    const inputCard = this._card();
    this._row(inputCard, 'Keyboard Navigation', this._toggle('accessibility.keyboardNav'), 'Use Tab/arrow keys to focus elements');
    this._row(inputCard, 'Sticky Keys', this._toggle('accessibility.stickyKeys'), 'Press modifier keys one at a time');
    this._row(inputCard, 'Cursor Size', this._slider('accessibility.cursorSize', 1, 3, 0.5, v => `${v}×`));
  }

  _buildPrivacy() {
    this._h('Privacy & Security');

    this._subh('Data');
    const dataCard = this._card();
    this._row(dataCard, 'Clear GSL Filesystem', this._dangerBtn('Clear VFS…', () => {
      if (confirm('Delete all GSL filesystem data? This cannot be undone.')) {
        indexedDB.deleteDatabase('geckoOS.gsl.fs');
        this.#kernel.notify('Settings', 'VFS cleared. Restart to re-provision.');
      }
    }));
    this._row(dataCard, 'Clear Calendar Events', this._dangerBtn('Clear Events…', () => {
      if (confirm('Delete all calendar events?')) {
        localStorage.removeItem('geckoOS.calendar.events');
        this.#kernel.notify('Settings', 'Calendar events cleared.');
      }
    }));
    this._row(dataCard, 'Clear Desktop Layout', this._dangerBtn('Reset Desktop…', () => {
      if (confirm('Reset desktop icon positions and shortcuts?')) {
        localStorage.removeItem('geckoOS.desktop.items');
        this.#kernel.notify('Settings', 'Desktop reset. Restart to apply.');
      }
    }));

    this._subh('Settings');
    const settingsCard = this._card();
    this._row(settingsCard, 'Reset All Settings', this._dangerBtn('Reset to Defaults…', () => {
      if (confirm('Reset all geckoOS settings to factory defaults? This cannot be undone.')) {
        this.#kernel.settings.reset();
        this.#kernel.notify('Settings', 'Settings reset to defaults.');
        this._showSection('general');
      }
    }));

    this._subh('Session');
    const sessionCard = this._card();
    this._row(sessionCard, 'Run Setup Wizard Again', this._btn('Open Setup…', () => {
      if (confirm('Run the OOBE setup wizard on next boot?')) {
        this.#kernel.settings.reset('oobe.completed');
        this.#kernel.notify('Settings', 'Setup wizard will run on next restart.');
      }
    }));
  }

  _dangerBtn(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:4px 14px;background:var(--color-error,#ff3b30);color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer;font-weight:500;';
    btn.addEventListener('click', action);
    return btn;
  }

  _btn(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:4px 14px;background:var(--color-accent);color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer;font-weight:500;';
    btn.addEventListener('click', action);
    return btn;
  }

  _buildGSL() {
    const gsl = this.#kernel.gsl;
    this._h('Gecko Subsystem for Linux');

    const heroCard = document.createElement('div');
    heroCard.style.cssText = 'display:flex;align-items:center;gap:14px;padding:16px;background:var(--color-surface-2);border-radius:12px;margin-bottom:20px;';
    heroCard.innerHTML = `
      <span style="font-size:40px">🐧</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--color-text-primary)">GSL ${gsl?.version ?? '?'}</div>
        <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">POSIX-compatible Linux environment in your browser</div>
      </div>`;
    this.#contentEl.appendChild(heroCard);

    this._subh('Status');
    const statusCard = this._card();
    this._row(statusCard, 'Enable GSL', this._toggle('gsl.enabled'));

    this._subh('System Info');
    const infoCard = this._card();
    [
      ['Version',         gsl?.version ?? 'N/A'],
      ['Filesystem',      'geckoVFS (IndexedDB, POSIX)'],
      ['Shell',           'gsh — bash-compatible'],
      ['Package Manager', 'APT (Gecko Package Archive)'],
      ['Network',         'geckoNet (fetch-based)'],
      ['Syscall table',   'POSIX-compatible'],
    ].forEach(([label, value]) => {
      const valEl = document.createElement('span');
      valEl.textContent = value;
      valEl.style.cssText = 'font-size:12px;color:var(--color-text-secondary);';
      this._row(infoCard, label, valEl);
    });

    const termBtn = this._btn('Open Terminal', () => this.#kernel.openApp('terminal'));
    termBtn.style.marginTop = '16px';
    this.#contentEl.appendChild(termBtn);
  }

  // ── Shared utility ────────────────────────────────────────────────────────

  _detectEngine(ua) {
    if (ua.includes('Firefox'))  return 'Gecko (Firefox)';
    if (ua.includes('Edg/'))     return 'Blink (Edge)';
    if (ua.includes('OPR/'))     return 'Blink (Opera)';
    if (ua.includes('Chrome'))   return 'Blink (Chromium)';
    if (ua.includes('Safari'))   return 'WebKit (Safari)';
    return 'Unknown';
  }

  _detectPlatform(ua) {
    if (ua.includes('Win'))     return 'Windows';
    if (ua.includes('Mac'))     return 'macOS';
    if (ua.includes('Linux'))   return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  _detectRenderer() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return 'Software (no WebGL)';
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'WebGL (masked)';
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
