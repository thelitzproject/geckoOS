export class NotificationCenter {
  #kernel;
  #tray;

  constructor(kernel) {
    this.#kernel = kernel;
    this.#tray   = document.getElementById('notification-tray');
  }

  push({ title, message, icon, duration = 4000, onClick }) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';

    const iconSrc = icon ?? this.#kernel.apps.get('settings')?.icon ?? 'assets/icons/system/gecko-mark.svg';
    toast.innerHTML = `
      <img class="notif-icon" src="${iconSrc}" alt="" />
      <div class="notif-body">
        <div class="notif-title">${title}</div>
        <div class="notif-message">${message}</div>
      </div>
      <span class="notif-time">now</span>`;

    toast.addEventListener('click', () => {
      this._dismiss(toast);
      onClick?.();
    });

    this.#tray.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this._dismiss(toast), duration);
    }
  }

  _dismiss(toast) {
    toast.classList.add('dismissing');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }
}
