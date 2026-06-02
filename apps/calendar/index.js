export default class CalendarApp {
  #kernel; #win;
  #year; #month;
  #headerEl; #gridEl;
  #events = {};   // { 'YYYY-MM-DD': [{ id, title, time }] }

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    const now = new Date();
    this.#year  = now.getFullYear();
    this.#month = now.getMonth();
    win.setTitle('Calendar');
    this._loadEvents();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  _loadEvents() {
    try {
      const raw = localStorage.getItem('geckoOS.calendar.events');
      this.#events = raw ? JSON.parse(raw) : {};
    } catch { this.#events = {}; }
  }

  _saveEvents() {
    localStorage.setItem('geckoOS.calendar.events', JSON.stringify(this.#events));
  }

  _dateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  _getEvents(key) { return this.#events[key] ?? []; }

  // ── Mount ────────────────────────────────────────────────────────────────

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:var(--color-window-bg);';

    this.#headerEl = document.createElement('div');
    this.#headerEl.style.cssText = 'display:flex;align-items:center;padding:16px 20px;border-bottom:0.5px solid var(--color-separator);flex-shrink:0;';
    container.appendChild(this.#headerEl);

    this.#gridEl = document.createElement('div');
    this.#gridEl.style.cssText = 'flex:1;padding:12px 20px;overflow-y:auto;';
    container.appendChild(this.#gridEl);

    this._render();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _render() {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    this.#headerEl.innerHTML = '';

    const prev = this._navBtn('‹', () => {
      this.#month--;
      if (this.#month < 0) { this.#month = 11; this.#year--; }
      this._render();
    });

    const title = document.createElement('h2');
    title.textContent = `${months[this.#month]} ${this.#year}`;
    title.style.cssText = 'flex:1;text-align:center;font-size:18px;font-weight:600;color:var(--color-text-primary);';

    const next = this._navBtn('›', () => {
      this.#month++;
      if (this.#month > 11) { this.#month = 0; this.#year++; }
      this._render();
    });

    const todayBtn = document.createElement('button');
    todayBtn.textContent = 'Today';
    todayBtn.style.cssText = 'padding:4px 12px;background:var(--color-accent);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      this.#year = now.getFullYear(); this.#month = now.getMonth();
      this._render();
    });

    this.#headerEl.append(prev, title, next, todayBtn);

    // Grid
    this.#gridEl.innerHTML = '';
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;';

    for (const d of weekdays) {
      const h = document.createElement('div');
      h.textContent = d;
      h.style.cssText = 'text-align:center;font-size:11px;font-weight:600;color:var(--color-text-tertiary);padding:4px;';
      grid.appendChild(h);
    }

    const firstDay     = new Date(this.#year, this.#month, 1).getDay();
    const daysInMonth  = new Date(this.#year, this.#month + 1, 0).getDate();
    const todayDate    = new Date();

    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
      const key     = this._dateKey(this.#year, this.#month, d);
      const evts    = this._getEvents(key);
      const isToday = d === todayDate.getDate() &&
                      this.#month === todayDate.getMonth() &&
                      this.#year  === todayDate.getFullYear();

      const cell = document.createElement('div');
      cell.style.cssText = [
        'padding:4px',
        'border-radius:8px',
        'cursor:pointer',
        'min-height:56px',
        'transition:background 80ms',
        isToday
          ? 'background:var(--color-accent);color:#fff;'
          : 'color:var(--color-text-primary);',
      ].join(';');

      const dayNum = document.createElement('div');
      dayNum.textContent = d;
      dayNum.style.cssText = `font-size:13px;font-weight:${isToday ? '700' : '400'};text-align:center;margin-bottom:2px;`;
      cell.appendChild(dayNum);

      // Show up to 2 event chips
      for (const evt of evts.slice(0, 2)) {
        const chip = document.createElement('div');
        chip.textContent = evt.title;
        chip.style.cssText = [
          'font-size:10px',
          'background:' + (isToday ? 'rgba(255,255,255,0.3)' : 'var(--color-accent)'),
          'color:#fff',
          'border-radius:3px',
          'padding:1px 4px',
          'margin-top:2px',
          'overflow:hidden',
          'text-overflow:ellipsis',
          'white-space:nowrap',
        ].join(';');
        cell.appendChild(chip);
      }
      if (evts.length > 2) {
        const more = document.createElement('div');
        more.textContent = `+${evts.length - 2} more`;
        more.style.cssText = 'font-size:10px;color:' + (isToday ? 'rgba(255,255,255,0.7)' : 'var(--color-text-tertiary)') + ';padding:0 2px;';
        cell.appendChild(more);
      }

      if (!isToday) {
        cell.addEventListener('mouseenter', () => cell.style.background = 'var(--color-surface-2)');
        cell.addEventListener('mouseleave', () => cell.style.background = '');
      }

      cell.addEventListener('click', () => this._openDay(key, d, evts));
      cell.addEventListener('dblclick', () => this._newEvent(key, d));

      grid.appendChild(cell);
    }

    this.#gridEl.appendChild(grid);
  }

  _navBtn(text, action) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'font-size:22px;background:none;border:none;cursor:pointer;color:var(--color-text-secondary);padding:0 12px;';
    btn.addEventListener('click', action);
    return btn;
  }

  // ── Day detail sheet ─────────────────────────────────────────────────────

  _openDay(key, day, evts) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateLabel = `${months[this.#month]} ${day}, ${this.#year}`;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);';

    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:var(--color-window-bg)',
      'border:0.5px solid var(--color-border)',
      'border-radius:14px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)',
      'width:340px',
      'max-height:480px',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;padding:16px 18px;border-bottom:0.5px solid var(--color-separator);';
    hdr.innerHTML = `<h2 style="flex:1;font-size:16px;font-weight:600;color:var(--color-text-primary);">${dateLabel}</h2>`;
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add';
    addBtn.style.cssText = 'padding:4px 12px;background:var(--color-accent);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
    addBtn.addEventListener('click', () => { overlay.remove(); this._newEvent(key, day); });
    hdr.appendChild(addBtn);

    // Event list
    const evtList = document.createElement('div');
    evtList.style.cssText = 'flex:1;overflow-y:auto;padding:8px;';

    const renderList = () => {
      evtList.innerHTML = '';
      const current = this._getEvents(key);
      if (current.length === 0) {
        evtList.innerHTML = '<p style="text-align:center;color:var(--color-text-tertiary);font-size:13px;padding:24px;">No events</p>';
        return;
      }
      for (const evt of current) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;margin-bottom:4px;background:var(--color-surface-1);';
        row.innerHTML = `
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;color:var(--color-text-primary);">${evt.title}</div>
            ${evt.time ? `<div style="font-size:11px;color:var(--color-text-secondary);">${evt.time}</div>` : ''}
          </div>`;
        const del = document.createElement('button');
        del.textContent = '✕';
        del.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--color-text-tertiary);font-size:14px;padding:0 4px;';
        del.addEventListener('click', () => {
          this.#events[key] = (this.#events[key] ?? []).filter(e => e.id !== evt.id);
          if (this.#events[key].length === 0) delete this.#events[key];
          this._saveEvents();
          this._render();
          renderList();
        });
        row.appendChild(del);
        evtList.appendChild(row);
      }
    };

    renderList();

    // Close
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 18px;border-top:0.5px solid var(--color-separator);display:flex;justify-content:flex-end;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done';
    closeBtn.style.cssText = 'padding:5px 18px;background:var(--color-surface-2);border:0.5px solid var(--color-border);border-radius:8px;font-size:13px;cursor:pointer;color:var(--color-text-primary);';
    closeBtn.addEventListener('click', () => overlay.remove());
    footer.appendChild(closeBtn);

    panel.append(hdr, evtList, footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ── New event dialog ──────────────────────────────────────────────────────

  _newEvent(key, day) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);';

    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:var(--color-window-bg)',
      'border:0.5px solid var(--color-border)',
      'border-radius:14px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)',
      'width:320px',
      'padding:20px 24px 22px',
    ].join(';');

    panel.innerHTML = `
      <h2 style="font-size:15px;font-weight:600;color:var(--color-text-primary);margin-bottom:16px;">New Event — ${months[this.#month]} ${day}, ${this.#year}</h2>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--color-text-secondary);">Title</label>
        <input id="evt-title" type="text" placeholder="Event title" style="display:block;width:100%;margin-top:4px;padding:7px 10px;border:0.5px solid var(--color-border);border-radius:8px;background:var(--color-surface-2);font-size:13px;color:var(--color-text-primary);outline:none;box-sizing:border-box;" />
      </div>
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;color:var(--color-text-secondary);">Time (optional)</label>
        <input id="evt-time" type="time" style="display:block;width:100%;margin-top:4px;padding:7px 10px;border:0.5px solid var(--color-border);border-radius:8px;background:var(--color-surface-2);font-size:13px;color:var(--color-text-primary);outline:none;box-sizing:border-box;" />
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="evt-cancel" style="padding:5px 16px;background:var(--color-surface-2);border:0.5px solid var(--color-border);border-radius:8px;font-size:13px;cursor:pointer;color:var(--color-text-primary);">Cancel</button>
        <button id="evt-add"    style="padding:5px 16px;background:var(--color-accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">Add Event</button>
      </div>`;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const titleInput = panel.querySelector('#evt-title');
    const timeInput  = panel.querySelector('#evt-time');
    titleInput.focus();

    const save = () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.style.border = '1px solid #ff3b30'; titleInput.focus(); return; }
      if (!this.#events[key]) this.#events[key] = [];
      this.#events[key].push({ id: Date.now().toString(36), title, time: timeInput.value || null });
      this._saveEvents();
      this._render();
      overlay.remove();
    };

    panel.querySelector('#evt-add').addEventListener('click', save);
    panel.querySelector('#evt-cancel').addEventListener('click', () => overlay.remove());
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  destroy() {}
}
