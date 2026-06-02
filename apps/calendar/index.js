export default class CalendarApp {
  #kernel; #win;
  #year; #month;
  #headerEl; #gridEl;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    const now = new Date();
    this.#year  = now.getFullYear();
    this.#month = now.getMonth();
    win.setTitle('Calendar');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:var(--color-window-bg);';

    // Header
    this.#headerEl = document.createElement('div');
    this.#headerEl.style.cssText = 'display:flex;align-items:center;padding:16px 20px;border-bottom:0.5px solid var(--color-separator);flex-shrink:0;';
    container.appendChild(this.#headerEl);

    // Calendar grid
    this.#gridEl = document.createElement('div');
    this.#gridEl.style.cssText = 'flex:1;padding:12px 20px;overflow-y:auto;';
    container.appendChild(this.#gridEl);

    this._render();
  }

  _render() {
    // Header
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    this.#headerEl.innerHTML = '';

    const prev = document.createElement('button');
    prev.textContent = '‹';
    prev.style.cssText = 'font-size:22px;background:none;border:none;cursor:pointer;color:var(--color-text-secondary);padding:0 12px;';
    prev.addEventListener('click', () => {
      this.#month--;
      if (this.#month < 0) { this.#month = 11; this.#year--; }
      this._render();
    });

    const title = document.createElement('h2');
    title.textContent = `${months[this.#month]} ${this.#year}`;
    title.style.cssText = 'flex:1;text-align:center;font-size:18px;font-weight:600;color:var(--color-text-primary);';

    const next = document.createElement('button');
    next.textContent = '›';
    next.style.cssText = prev.style.cssText;
    next.addEventListener('click', () => {
      this.#month++;
      if (this.#month > 11) { this.#month = 0; this.#year++; }
      this._render();
    });

    const today = document.createElement('button');
    today.textContent = 'Today';
    today.style.cssText = 'padding:4px 12px;background:var(--color-accent);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
    today.addEventListener('click', () => {
      const now = new Date();
      this.#year = now.getFullYear(); this.#month = now.getMonth();
      this._render();
    });

    this.#headerEl.append(prev, title, next, today);

    // Grid
    this.#gridEl.innerHTML = '';

    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;';

    // Day headers
    for (const d of weekdays) {
      const h = document.createElement('div');
      h.textContent = d;
      h.style.cssText = 'text-align:center;font-size:11px;font-weight:600;color:var(--color-text-tertiary);padding:4px;';
      grid.appendChild(h);
    }

    const firstDay = new Date(this.#year, this.#month, 1).getDay();
    const daysInMonth = new Date(this.#year, this.#month + 1, 0).getDate();
    const today2 = new Date();

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      const isToday = d === today2.getDate() && this.#month === today2.getMonth() && this.#year === today2.getFullYear();

      cell.style.cssText = `text-align:center;padding:8px 4px;border-radius:8px;cursor:pointer;font-size:13px;
        ${isToday ? 'background:var(--color-accent);color:#fff;font-weight:600;' : 'color:var(--color-text-primary);'}
        transition:background 80ms;`;
      cell.textContent = d;

      if (!isToday) {
        cell.addEventListener('mouseenter', () => cell.style.background = 'var(--color-surface-2)');
        cell.addEventListener('mouseleave', () => cell.style.background = '');
      }

      grid.appendChild(cell);
    }

    this.#gridEl.appendChild(grid);
  }

  destroy() {}
}
