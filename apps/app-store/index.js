/**
 * Gecko App Store — browse and install web apps
 */

const FEATURED_APPS = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'https://www.youtube.com/favicon.ico',
    description: 'Watch videos, music, and live streams.',
    category: 'Entertainment',
    url: 'https://www.youtube.com',
    developer: 'Google LLC',
    free: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'https://github.com/favicon.ico',
    description: 'Code hosting and collaboration.',
    category: 'Developer Tools',
    url: 'https://github.com',
    developer: 'Microsoft',
    free: true,
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: 'https://static.figma.com/app/icon/1/favicon.png',
    description: 'Design and prototype together.',
    category: 'Design',
    url: 'https://figma.com',
    developer: 'Figma Inc.',
    free: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: 'https://www.notion.so/front-static/favicon.ico',
    description: 'All-in-one workspace for notes and docs.',
    category: 'Productivity',
    url: 'https://notion.so',
    developer: 'Notion Labs',
    free: true,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: 'https://open.spotify.com/favicon.ico',
    description: 'Stream music and podcasts.',
    category: 'Music',
    url: 'https://open.spotify.com',
    developer: 'Spotify AB',
    free: true,
  },
  {
    id: 'vscode-web',
    name: 'VS Code Web',
    icon: 'https://vscode.dev/static/stable/product-icons/microsoft-logo.svg',
    description: 'Full VS Code experience in the browser.',
    category: 'Developer Tools',
    url: 'https://vscode.dev',
    developer: 'Microsoft',
    free: true,
  },
];

export default class AppStoreApp {
  #kernel;
  #win;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('Gecko App Store');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:var(--color-window-bg);';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px 16px;border-bottom:0.5px solid var(--color-separator);flex-shrink:0;display:flex;align-items:center;gap:12px;';
    header.innerHTML = `
      <div style="flex:1">
        <h1 style="font-size:20px;font-weight:700;color:var(--color-text-primary)">Gecko App Store</h1>
        <p style="font-size:12px;color:var(--color-text-secondary)">Install web apps into geckoOS</p>
      </div>`;

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search apps...';
    search.style.cssText = 'padding:6px 12px;border:0.5px solid var(--color-border);border-radius:8px;background:var(--color-surface-2);font-size:13px;width:200px;color:var(--color-text-primary);';
    search.addEventListener('input', () => this._renderGrid(grid, search.value));
    header.appendChild(search);

    // Content
    const scroll = document.createElement('div');
    scroll.style.cssText = 'flex:1;overflow-y:auto;padding:20px 24px;';

    const featuredTitle = document.createElement('h2');
    featuredTitle.textContent = 'Featured';
    featuredTitle.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:14px;color:var(--color-text-primary);';
    scroll.appendChild(featuredTitle);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;';
    scroll.appendChild(grid);

    container.append(header, scroll);
    this._renderGrid(grid, '');
  }

  _renderGrid(grid, query) {
    grid.innerHTML = '';
    const apps = query
      ? FEATURED_APPS.filter(a =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.category.toLowerCase().includes(query.toLowerCase())
        )
      : FEATURED_APPS;

    for (const app of apps) {
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--color-surface-1);border:0.5px solid var(--color-border);border-radius:12px;padding:16px;cursor:pointer;transition:box-shadow 100ms;';
      card.addEventListener('mouseenter', () => card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)');
      card.addEventListener('mouseleave', () => card.style.boxShadow = '');

      const installed = this.#kernel.apps.get(app.id) !== null;

      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;">
          <img src="${app.icon}" alt="" style="width:48px;height:48px;border-radius:10px;flex-shrink:0;background:var(--color-surface-2);" onerror="this.style.display='none'" />
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--color-text-primary)">${app.name}</div>
            <div style="font-size:11px;color:var(--color-text-secondary)">${app.category}</div>
            <div style="font-size:11px;color:var(--color-text-tertiary)">${app.developer}</div>
          </div>
        </div>
        <p style="font-size:12px;color:var(--color-text-secondary);line-height:1.4;margin-bottom:12px;">${app.description}</p>
        <button class="install-btn" style="width:100%;padding:6px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:${installed ? 'var(--color-surface-2)' : 'var(--color-accent)'};color:${installed ? 'var(--color-text-secondary)' : '#fff'};">
          ${installed ? 'Open' : 'Get'}
        </button>`;

      card.querySelector('.install-btn').addEventListener('click', () => {
        if (installed) {
          this.#kernel.openApp(app.id);
        } else {
          this._install(app, card);
        }
      });

      grid.appendChild(card);
    }

    if (!apps.length) {
      grid.innerHTML = '<p style="color:var(--color-text-secondary);font-size:13px;grid-column:1/-1;text-align:center;padding:40px">No apps found.</p>';
    }
  }

  _install(app, card) {
    const manifest = {
      id:       app.id,
      name:     app.name,
      icon:     app.icon,
      module:   null, // iframe app
      iframeUrl: app.url,
      category: app.category.toLowerCase().replace(' ', '-'),
      keywords: [app.name.toLowerCase(), app.category.toLowerCase()],
      defaultSize: { width: 1024, height: 680 },
      allowMultiple: true,
      isWebApp: true,
    };

    // For web apps, the module is a dynamic web-app wrapper
    manifest.module = '../../apps/browser/index.js';

    this.#kernel.apps.install(manifest);

    const btn = card.querySelector('.install-btn');
    btn.textContent = 'Open';
    btn.style.background = 'var(--color-surface-2)';
    btn.style.color = 'var(--color-text-secondary)';
    btn.addEventListener('click', () => this.#kernel.openApp(app.id, { url: app.url }), { once: true });

    this.#kernel.notify('App Store', `${app.name} installed`, { icon: app.icon });
  }

  destroy() {}
}
