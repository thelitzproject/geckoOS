/**
 * Minesweeper — classic grid-based puzzle game
 */
const PRESETS = {
  easy:   { cols: 9,  rows: 9,  mines: 10 },
  medium: { cols: 16, rows: 16, mines: 40 },
  hard:   { cols: 30, rows: 16, mines: 99 },
};

export default class MinesweeperApp {
  #kernel; #win;
  #grid = [];
  #cols; #rows; #mines;
  #revealed = 0;
  #flagged  = 0;
  #state    = 'idle'; // idle | playing | won | lost
  #firstClick = true;
  #startTime; #elapsed = 0;
  #timerInterval;

  #gridEl; #mineCountEl; #timerEl; #faceBtn;
  #difficulty = 'easy';

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('Minesweeper');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:#c0c0c0;height:100%;padding:8px;gap:0;font-family:monospace;user-select:none;';

    // Difficulty bar
    const diffBar = document.createElement('div');
    diffBar.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
    for (const [key, label] of [['easy','Easy'],['medium','Medium'],['hard','Hard']]) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `padding:3px 10px;border:2px outset #fff;background:${key===this.#difficulty?'#a0a0a0':'#c0c0c0'};font-size:12px;cursor:pointer;font-family:monospace;`;
      btn.addEventListener('click', () => {
        this.#difficulty = key;
        diffBar.querySelectorAll('button').forEach(b => b.style.background = '#c0c0c0');
        btn.style.background = '#a0a0a0';
        this._newGame();
      });
      diffBar.appendChild(btn);
    }
    container.appendChild(diffBar);

    // Header panel
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#c0c0c0;border:3px inset #808080;padding:6px 12px;width:100%;max-width:600px;margin-bottom:6px;';

    this.#mineCountEl = document.createElement('div');
    this.#mineCountEl.style.cssText = 'background:#000;color:#f00;font-size:24px;font-weight:bold;padding:2px 6px;min-width:52px;text-align:right;letter-spacing:2px;';

    this.#faceBtn = document.createElement('button');
    this.#faceBtn.style.cssText = 'font-size:22px;background:#c0c0c0;border:3px outset #fff;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    this.#faceBtn.textContent = '🙂';
    this.#faceBtn.addEventListener('click', () => this._newGame());

    this.#timerEl = document.createElement('div');
    this.#timerEl.style.cssText = 'background:#000;color:#f00;font-size:24px;font-weight:bold;padding:2px 6px;min-width:52px;text-align:right;letter-spacing:2px;';
    this.#timerEl.textContent = '000';

    header.append(this.#mineCountEl, this.#faceBtn, this.#timerEl);
    container.appendChild(header);

    // Grid container
    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = 'border:3px inset #808080;overflow:auto;max-width:100%;';
    this.#gridEl = document.createElement('div');
    gridWrap.appendChild(this.#gridEl);
    container.appendChild(gridWrap);

    this._newGame();

    container.addEventListener('contextmenu', e => e.preventDefault());
  }

  _newGame() {
    clearInterval(this.#timerInterval);
    const preset = PRESETS[this.#difficulty];
    this.#cols = preset.cols;
    this.#rows = preset.rows;
    this.#mines = preset.mines;
    this.#revealed = 0;
    this.#flagged  = 0;
    this.#state    = 'idle';
    this.#firstClick = true;
    this.#elapsed  = 0;
    this.#faceBtn.textContent = '🙂';
    this.#timerEl.textContent = '000';
    this._updateMineCount();
    this._buildGrid();
    this._renderGrid();
  }

  _buildGrid() {
    this.#grid = [];
    for (let r = 0; r < this.#rows; r++) {
      this.#grid[r] = [];
      for (let c = 0; c < this.#cols; c++) {
        this.#grid[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 };
      }
    }
  }

  _placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < this.#mines) {
      const r = Math.floor(Math.random() * this.#rows);
      const c = Math.floor(Math.random() * this.#cols);
      if (!this.#grid[r][c].mine && !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) {
        this.#grid[r][c].mine = true;
        placed++;
      }
    }
    // Calculate adjacency
    for (let r = 0; r < this.#rows; r++) {
      for (let c = 0; c < this.#cols; c++) {
        if (!this.#grid[r][c].mine) {
          this.#grid[r][c].adj = this._neighbors(r, c).filter(([nr, nc]) => this.#grid[nr][nc].mine).length;
        }
      }
    }
  }

  _neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.#rows && nc >= 0 && nc < this.#cols) out.push([nr, nc]);
      }
    }
    return out;
  }

  _renderGrid() {
    const CELL = this.#difficulty === 'hard' ? 20 : 26;
    this.#gridEl.innerHTML = '';
    this.#gridEl.style.cssText = `display:grid;grid-template-columns:repeat(${this.#cols},${CELL}px);gap:0;`;

    const ADJ_COLORS = ['','#0000ff','#007b00','#ff0000','#00008b','#8b0000','#008b8b','#000','#808080'];

    for (let r = 0; r < this.#rows; r++) {
      for (let c = 0; c < this.#cols; c++) {
        const cell = this.#grid[r][c];
        const el = document.createElement('div');
        el.style.cssText = `width:${CELL}px;height:${CELL}px;display:flex;align-items:center;justify-content:center;font-size:${CELL-8}px;font-weight:bold;cursor:pointer;`;

        if (cell.revealed) {
          el.style.background = '#c0c0c0';
          el.style.border = '1px solid #808080';
          if (cell.mine) {
            el.textContent = '💣';
            if (this.#state === 'lost') el.style.background = '#ff0000';
          } else if (cell.adj > 0) {
            el.textContent = cell.adj;
            el.style.color = ADJ_COLORS[cell.adj];
          }
        } else if (cell.flagged) {
          el.style.cssText += 'background:#c0c0c0;border:2px outset #fff;';
          el.textContent = '🚩';
        } else {
          el.style.cssText += 'background:#c0c0c0;border:2px outset #fff;';
          if (this.#state !== 'idle' && this.#state !== 'playing') el.textContent = cell.mine ? '💣' : '';
        }

        el.addEventListener('click', () => this._reveal(r, c));
        el.addEventListener('contextmenu', e => { e.preventDefault(); this._flag(r, c); });
        el.addEventListener('mousedown',  () => { if (this.#state === 'playing') this.#faceBtn.textContent = '😮'; });
        el.addEventListener('mouseup',    () => { if (this.#state === 'playing') this.#faceBtn.textContent = '🙂'; });

        this.#gridEl.appendChild(el);
      }
    }
  }

  _reveal(r, c) {
    if (this.#state === 'won' || this.#state === 'lost') return;
    const cell = this.#grid[r][c];
    if (cell.revealed || cell.flagged) return;

    if (this.#firstClick) {
      this.#firstClick = false;
      this.#state = 'playing';
      this._placeMines(r, c);
      this.#startTime = Date.now();
      this.#timerInterval = setInterval(() => {
        this.#elapsed = Math.min(999, Math.floor((Date.now() - this.#startTime) / 1000));
        this.#timerEl.textContent = String(this.#elapsed).padStart(3, '0');
      }, 1000);
    }

    this._floodReveal(r, c);
    this._renderGrid();

    if (cell.mine) {
      this.#state = 'lost';
      this.#faceBtn.textContent = '😵';
      clearInterval(this.#timerInterval);
    } else if (this.#revealed === this.#cols * this.#rows - this.#mines) {
      this.#state = 'won';
      this.#faceBtn.textContent = '😎';
      clearInterval(this.#timerInterval);
    }
  }

  _floodReveal(r, c) {
    const cell = this.#grid[r][c];
    if (cell.revealed || cell.flagged || cell.mine) return;
    cell.revealed = true;
    this.#revealed++;
    if (cell.adj === 0) {
      this._neighbors(r, c).forEach(([nr, nc]) => this._floodReveal(nr, nc));
    }
  }

  _flag(r, c) {
    if (this.#state === 'won' || this.#state === 'lost') return;
    const cell = this.#grid[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    this.#flagged += cell.flagged ? 1 : -1;
    this._updateMineCount();
    this._renderGrid();
  }

  _updateMineCount() {
    const n = this.#mines - this.#flagged;
    this.#mineCountEl.textContent = String(Math.max(-99, n)).padStart(3, '0');
  }

  destroy() { clearInterval(this.#timerInterval); }
}
