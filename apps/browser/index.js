/**
 * geckoOS Browser — powered by browser.js (https://github.com/thelitzproject/browser.js)
 *
 * Wraps the browser.js chrome in a geckoOS window.
 * Requires vendor/browser.js to be built first:
 *   git submodule update --init vendor/browser.js
 *   npm run build:vendor
 */

const BROWSER_DIST = 'vendor/browser.js/packages/chrome/dist/index.html';

export default class BrowserApp {
  #kernel; #win; #iframe;
  #initialUrl;

  constructor(kernel, win, args) {
    this.#kernel     = kernel;
    this.#win        = win;
    this.#initialUrl = args?.url ?? null;
    win.setTitle('Browser');
  }

  async mount(container) {
    container.style.cssText = 'height:100%;overflow:hidden;position:relative;background:#13131f;';

    // Check if browser.js has been built before creating the iframe.
    let available = false;
    try {
      const r = await fetch(BROWSER_DIST, { method: 'HEAD', cache: 'no-store' });
      available = r.ok;
    } catch {}

    if (!available) {
      this._showSetupGuide(container);
      return;
    }

    this.#iframe = document.createElement('iframe');
    this.#iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    this.#iframe.allow = 'clipboard-read; clipboard-write; fullscreen';

    const src = this.#initialUrl
      ? `${BROWSER_DIST}?url=${encodeURIComponent(this.#initialUrl)}`
      : BROWSER_DIST;

    this.#iframe.src = src;

    this.#iframe.addEventListener('load', () => {
      try {
        const title = this.#iframe.contentDocument?.title;
        if (title) this.#win.setTitle(title);
      } catch {}
    });

    container.appendChild(this.#iframe);
  }

  _showSetupGuide(container) {
    const el = document.createElement('div');
    el.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'height:100%;padding:40px;text-align:center;color:#e2e2f0;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
    ].join('');

    el.innerHTML = `
      <div style="font-size:48px;margin-bottom:20px">🌐</div>
      <h2 style="font-size:18px;font-weight:600;margin-bottom:8px">Browser needs a one-time build</h2>
      <p style="font-size:13px;color:#9090b0;max-width:360px;line-height:1.6;margin-bottom:20px">
        browser.js ships as TypeScript source and must be compiled before use.
        Run these two commands in the geckoOS root, then reload:
      </p>
      <pre style="background:#1a1a2e;border:1px solid #2a2a42;border-radius:10px;padding:16px 20px;font-size:12px;text-align:left;line-height:1.8;color:#c0c0e0;margin-bottom:20px;">git clone --depth=1 https://github.com/thelitzproject/browser.js vendor/browser.js
git clone --depth=1 https://github.com/MercuryWorkshop/dreamlandjs vendor/browser.js/external/dreamlandjs
npm run build:vendor</pre>
      <p style="font-size:11px;color:#555570">
        On GitHub Pages this is handled automatically by the deploy workflow.
      </p>`;

    container.appendChild(el);
  }

  destroy() {
    this.#iframe?.remove();
  }
}
