/**
 * geckoOS App Template — Hello World
 * Copy this folder and customize to create a new app.
 */
import { GeckoApp } from '../../api/gecko-sdk.js';

export default class HelloWorldApp extends GeckoApp {
  async mount(container) {
    container.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;background:var(--color-window-bg);flex-direction:column;gap:12px;';
    container.innerHTML = `
      <h1 style="font-size:28px;font-weight:600;color:var(--color-text-primary)">Hello, geckoOS!</h1>
      <p style="font-size:14px;color:var(--color-text-secondary)">Your first geckoOS app is running.</p>
      <button id="notify-btn" style="padding:8px 20px;background:var(--color-accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
        Send Notification
      </button>`;

    container.querySelector('#notify-btn').addEventListener('click', () => {
      this.notify('Hello World', 'This notification was sent from your app!');
    });
  }
}
