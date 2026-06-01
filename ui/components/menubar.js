export class MenuBar {
  #kernel;
  #clockEl;
  #appNameEl;
  #clockTimer;

  constructor(kernel) {
    this.#kernel = kernel;
    this.#clockEl   = document.getElementById('menubar-clock');
    this.#appNameEl = document.getElementById('menubar-app-name');

    this._initClock();
    this._initButtons();
    this._initGeckoMenu();
    this.setActiveApp(null);
  }

  _initClock() {
    const tick = () => {
      const now   = new Date();
      const h24   = this.#kernel.settings.get('menubar.clock24h');
      const showD = this.#kernel.settings.get('menubar.showDate');

      const time = now.toLocaleTimeString([], {
        hour: 'numeric', minute: '2-digit', second: undefined,
        hour12: !h24,
      });
      const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      this.#clockEl.textContent = showD ? `${date}  ${time}` : time;
    };

    tick();
    this.#clockTimer = setInterval(tick, 1000);
  }

  _initButtons() {
    // spotlight-btn is bound by Spotlight._bind() — do not add a second listener here.

    document.getElementById('wifi-indicator').addEventListener('click', () => {
      this.#kernel.notify('Network', navigator.onLine ? 'Connected' : 'No internet connection');
    });

    this.#clockEl.addEventListener('click', () => {
      this.#kernel.openApp('calendar');
    });
  }

  _initGeckoMenu() {
    const btn      = document.getElementById('gecko-menu-btn');
    const dropdown = document.getElementById('gecko-menu-dropdown');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = !dropdown.hidden;
      dropdown.hidden = isOpen;
    });

    dropdown.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      dropdown.hidden = true;

      switch (action) {
        case 'about':     this.#kernel.openApp('about'); break;
        case 'app-store': this.#kernel.openApp('app-store'); break;
        case 'settings':  this.#kernel.openApp('settings'); break;
case 'restart':   this._confirmRestart(); break;
      }
    });

    document.addEventListener('click', () => { dropdown.hidden = true; });
  }

  setActiveApp(appId) {
    const manifest = appId ? this.#kernel.apps.get(appId) : null;
    this.#appNameEl.textContent = manifest?.name ?? 'geckoOS';

    // Clear old app menus
    const menusEl = document.getElementById('menubar-app-menus');
    menusEl.innerHTML = '';

    const menus = manifest?.menus ?? this._geckoDefaultMenus();
    for (const menu of menus) {
      const btn = document.createElement('button');
      btn.className = 'menubar-item';
      btn.textContent = menu.label;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._openMenu(btn, menu.items);
      });
      menusEl.appendChild(btn);
    }
  }

  _geckoDefaultMenus() {
    return [
      {
        label: 'File',
        items: [
          { label: 'New Window',  shortcut: '⌘N', action: () => {} },
          { separator: true },
          { label: 'Close',       shortcut: '⌘W', action: () => {} },
        ],
      },
      {
        label: 'Edit',
        items: [
          { label: 'Undo',  shortcut: '⌘Z', action: () => document.execCommand('undo') },
          { label: 'Redo',  shortcut: '⌘Y', action: () => document.execCommand('redo') },
          { separator: true },
          { label: 'Cut',   shortcut: '⌘X', action: () => document.execCommand('cut') },
          { label: 'Copy',  shortcut: '⌘C', action: () => document.execCommand('copy') },
          { label: 'Paste', shortcut: '⌘V', action: () => document.execCommand('paste') },
        ],
      },
      {
        label: 'View',
        items: [
          { label: 'Toggle Theme', action: () => {
            const cur = this.#kernel.settings.get('appearance.theme');
            this.#kernel.settings.set('appearance.theme', cur === 'dark' ? 'light' : 'dark');
          }},
        ],
      },
    ];
  }

  _openMenu(anchor, items) {
    // Close any existing
    document.querySelectorAll('.menubar-dropdown').forEach(d => d.remove());

    const rect = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'menubar-dropdown';
    el.style.left = `${rect.left}px`;

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'menubar-dropdown-separator';
        el.appendChild(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = 'menubar-dropdown-item';

      const label = document.createElement('span');
      label.textContent = item.label;
      btn.appendChild(label);

      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'shortcut';
        sc.textContent = item.shortcut;
        btn.appendChild(sc);
      }

      btn.addEventListener('click', () => {
        el.remove();
        item.action?.();
      });
      el.appendChild(btn);
    }

    document.body.appendChild(el);
    const close = () => { el.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  _showAbout() {
    const win = this.#kernel.wm.create({
      title: 'About geckoOS',
      width: 360, height: 260,
      resizable: false,
      appId: 'about',
    });
    win.content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:24px;text-align:center;background:var(--color-window-bg)">
        <img src="assets/icons/system/gecko-mark.svg" style="width:80px;height:80px" />
        <h1 style="font-size:24px;font-weight:600">geckoOS</h1>
        <p style="font-size:14px;color:var(--color-text-secondary)">Version 1.0.0 "Bijou"</p>
        <p style="font-size:12px;color:var(--color-text-tertiary)">GSL v${this.#kernel.gsl?.version ?? '?'}</p>
        <p style="font-size:11px;color:var(--color-text-tertiary);max-width:260px">A browser-based desktop OS with Mac-style UI and Gecko Subsystem for Linux.</p>
      </div>`;
  }

_confirmRestart() {
    if (confirm('Restart geckoOS? Unsaved work will be lost.')) {
      location.reload();
    }
  }

  destroy() {
    clearInterval(this.#clockTimer);
  }
}
