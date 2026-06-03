export class NotificationCenter {
  #kernel;
  #tray;

  constructor(kernel) {
    this.#kernel = kernel;
    this.#tray   = document.getElementById('notification-tray');
  }

  push({ title, message, icon, duration, onClick }) {
    // Global kill-switches
    if (!this.#kernel.settings.get('notifications.enabled', true)) return;
    if (this.#kernel.settings.get('notifications.dnd', false)) return;

    // Per-app opt-out via notifications.app.<appId>
    const appId = this.#kernel.apps.all().find(a => a.name === title)?.id;
    if (appId && this.#kernel.settings.get(`notifications.app.${appId}`, true) === false) return;

    // Duration: caller overrides setting, 0 means never auto-dismiss
    const settingDur = Number(this.#kernel.settings.get('notifications.duration', '4000'));
    const ms = duration ?? (settingDur > 0 ? settingDur : 0);

    const toast = document.createElement('div');
    toast.className = 'notification-toast';

    const iconSrc = icon ?? 'assets/icons/system/gecko-mark.svg';
    toast.innerHTML = `
      <img class="notif-icon" src="${iconSrc}" alt="" />
      <div class="notif-body">
        <div class="notif-title">${title}</div>
        <div class="notif-message">${message}</div>
      </div>
      <button class="notif-close" aria-label="Dismiss" style="background:none;border:none;cursor:pointer;color:var(--color-text-tertiary);font-size:11px;padding:0 2px;flex-shrink:0;align-self:flex-start;">✕</button>`;

    toast.addEventListener('click', e => {
      if (!e.target.closest('.notif-close')) { this._dismiss(toast); onClick?.(); }
    });
    toast.querySelector('.notif-close').addEventListener('click', e => {
      e.stopPropagation(); this._dismiss(toast);
    });

    this.#tray.appendChild(toast);
    if (ms > 0) setTimeout(() => this._dismiss(toast), ms);
  }

  _dismiss(toast) {
    if (toast._dismissing) return;
    toast._dismissing = true;
    toast.classList.add('dismissing');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }
}
