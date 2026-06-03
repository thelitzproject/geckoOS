/**
 * geckoOS Browser — powered by browser.js
 * https://github.com/thelitzproject/browser.js
 *
 * Run `npm run setup:browser` once to clone and build browser.js.
 * The built output at vendor/browser.js/packages/chrome/dist/ is then
 * loaded in a full-viewport iframe inside this window.
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
    container.style.cssText = 'height:100%;overflow:hidden;position:relative;background:#0d0d14;';

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
    this.#iframe.allow = 'clipboard-read; clipboard-write; fullscreen; autoplay';

    const src = this.#initialUrl
      ? `${BROWSER_DIST}?url=${encodeURIComponent(this.#initialUrl)}`
      : BROWSER_DIST;

    this.#iframe.src = src;

    this.#iframe.addEventListener('load', () => {
      try {
        const title = this.#iframe.contentDocument?.title;
        if (title && title !== 'browser.js') this.#win.setTitle(title);
      } catch {}
    });

    container.appendChild(this.#iframe);
  }

  _showSetupGuide(container) {
    container.style.cssText += ';display:flex;align-items:center;justify-content:center;';

    const card = document.createElement('div');
    card.style.cssText = [
      'background:rgba(255,255,255,0.04)',
      'border:0.5px solid rgba(255,255,255,0.1)',
      'border-radius:16px',
      'padding:36px 40px',
      'max-width:480px',
      'width:100%',
      'text-align:center',
      'color:#e2e2f0',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
    ].join(';');

    card.innerHTML = `
      <img src="assets/icons/apps/browser.svg" style="width:64px;height:64px;margin-bottom:16px;" alt="" />
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px;">One-time setup required</h2>
      <p style="font-size:13px;color:#9090b0;line-height:1.7;margin-bottom:24px;">
        browser.js hasn't been built yet. Run this single command in the
        geckoOS project root — it clones and builds everything automatically:
      </p>

      <div style="background:#0a0a18;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px 18px;margin-bottom:24px;text-align:left;">
        <code style="font-size:13px;color:#7dd3fc;font-family:'SF Mono','Fira Code',monospace;white-space:nowrap;">npm run setup:browser</code>
      </div>

      <p style="font-size:12px;color:#555580;line-height:1.6;margin-bottom:20px;">
        This clones <strong style="color:#8080b0">thelitzproject/browser.js</strong> into
        <code style="color:#7dd3fc;font-size:11px;">vendor/browser.js/</code> and builds
        the TypeScript + Rust source. Requires <strong style="color:#8080b0">pnpm</strong>
        and <strong style="color:#8080b0">Rust/cargo</strong> to be installed.
      </p>

      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="retry-btn" style="padding:8px 20px;background:rgba(99,102,241,0.8);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">
          Check Again
        </button>
        <a href="https://github.com/thelitzproject/browser.js" target="_blank"
           style="padding:8px 20px;background:rgba(255,255,255,0.08);color:#c0c0e0;border:none;border-radius:8px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          View on GitHub ↗
        </a>
      </div>

      <p style="margin-top:20px;font-size:11px;color:#444466;">
        Already built? Reload geckoOS after the build completes.
      </p>`;

    card.querySelector('#retry-btn').addEventListener('click', async () => {
      try {
        const r = await fetch(BROWSER_DIST, { method: 'HEAD', cache: 'no-store' });
        if (r.ok) location.reload();
        else {
          const btn = card.querySelector('#retry-btn');
          btn.textContent = 'Not found yet';
          btn.style.background = 'rgba(239,68,68,0.7)';
          setTimeout(() => { btn.textContent = 'Check Again'; btn.style.background = 'rgba(99,102,241,0.8)'; }, 2000);
        }
      } catch {}
    });

    container.appendChild(card);
  }

  destroy() {
    this.#iframe?.remove();
  }
}
