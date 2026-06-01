export class ContextMenu {
  #kernel;
  #el;

  constructor(kernel) {
    this.#kernel = kernel;
    this.#el = document.getElementById('context-menu');
    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', () => this.hide());
  }

  show(x, y, items) {
    this.#el.innerHTML = '';

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'ctx-separator';
        this.#el.appendChild(sep);
        continue;
      }

      const btn = document.createElement('div');
      btn.className = 'ctx-item' + (item.disabled ? ' disabled' : '');

      if (item.icon) {
        const ic = document.createElement('span');
        ic.innerHTML = item.icon;
        btn.appendChild(ic);
      }

      const lbl = document.createElement('span');
      lbl.textContent = item.label;
      btn.appendChild(lbl);

      if (item.submenu) {
        const arr = document.createElement('span');
        arr.className = 'ctx-submenu-arrow';
        arr.textContent = '›';
        btn.appendChild(arr);
      }

      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!item.disabled && item.action) {
          this.hide();
          item.action();
        }
      });

      this.#el.appendChild(btn);
    }

    // Position — keep in viewport
    this.#el.hidden = false;
    const rect = this.#el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    const left = x + rect.width  > vw ? Math.max(0, vw - rect.width  - 4) : x;
    const top  = y + rect.height > vh ? Math.max(28, y - rect.height)      : y;

    this.#el.style.left = `${left}px`;
    this.#el.style.top  = `${top}px`;
  }

  hide() {
    this.#el.hidden = true;
  }
}
