/**
 * Snake — classic arcade game
 */
const CELL = 20;
const COLS = 20;
const ROWS = 20;
const TICK = 120;

export default class SnakeApp {
  #kernel; #win;
  #canvas; #ctx;
  #snake; #dir; #next;
  #food;
  #score = 0;
  #best  = 0;
  #timer = null;
  #alive = false;
  #scoreEl;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    this.#best   = parseInt(localStorage.getItem('gecko.snake.best') || '0', 10);
    win.setTitle('Snake');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1a1a2e;gap:12px;';

    this.#scoreEl = document.createElement('div');
    this.#scoreEl.style.cssText = 'color:#fff;font-size:15px;font-weight:500;letter-spacing:0.5px;font-family:monospace;';
    container.appendChild(this.#scoreEl);

    this.#canvas = document.createElement('canvas');
    this.#canvas.width  = COLS * CELL;
    this.#canvas.height = ROWS * CELL;
    this.#canvas.style.cssText = 'border-radius:8px;cursor:pointer;';
    this.#ctx = this.#canvas.getContext('2d');
    container.appendChild(this.#canvas);

    const hint = document.createElement('div');
    hint.style.cssText = 'color:rgba(255,255,255,0.3);font-size:12px;';
    hint.textContent = 'Arrow keys or WASD · Click to start';
    container.appendChild(hint);

    this.#canvas.addEventListener('click', () => { if (!this.#alive) this._start(); });
    this._onKey = this._handleKey.bind(this);
    window.addEventListener('keydown', this._onKey);

    this._drawIdle();
  }

  _start() {
    this.#snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    this.#dir   = { x: 1, y: 0 };
    this.#next  = { x: 1, y: 0 };
    this.#score = 0;
    this.#alive = true;
    this._placeFood();
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this._tick(), TICK);
  }

  _tick() {
    this.#dir = this.#next;
    const head = {
      x: (this.#snake[0].x + this.#dir.x + COLS) % COLS,
      y: (this.#snake[0].y + this.#dir.y + ROWS) % ROWS,
    };

    // Self collision
    if (this.#snake.some(s => s.x === head.x && s.y === head.y)) {
      this._gameOver(); return;
    }

    this.#snake.unshift(head);

    if (head.x === this.#food.x && head.y === this.#food.y) {
      this.#score++;
      if (this.#score > this.#best) {
        this.#best = this.#score;
        localStorage.setItem('gecko.snake.best', this.#best);
      }
      this._placeFood();
    } else {
      this.#snake.pop();
    }

    this._draw();
  }

  _placeFood() {
    do {
      this.#food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (this.#snake.some(s => s.x === this.#food.x && s.y === this.#food.y));
  }

  _draw() {
    const ctx = this.#ctx;
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }

    // Food
    ctx.fillStyle = '#ff375f';
    this._roundRect(ctx, this.#food.x * CELL + 3, this.#food.y * CELL + 3, CELL - 6, CELL - 6, 4);

    // Snake
    this.#snake.forEach((seg, i) => {
      const t = i / this.#snake.length;
      ctx.fillStyle = i === 0 ? '#34c759' : `hsl(${140 - t * 30}, ${80 - t * 20}%, ${50 - t * 15}%)`;
      this._roundRect(ctx, seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, i === 0 ? 5 : 3);
    });

    this.#scoreEl.textContent = `Score: ${this.#score}   Best: ${this.#best}`;
  }

  _drawIdle() {
    const ctx = this.#ctx;
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SNAKE', COLS * CELL / 2, ROWS * CELL / 2 - 12);
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('Click or press any arrow key to play', COLS * CELL / 2, ROWS * CELL / 2 + 16);
    this.#scoreEl.textContent = `Best: ${this.#best}`;
  }

  _gameOver() {
    clearInterval(this.#timer);
    this.#alive = false;
    const ctx = this.#ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.fillStyle = '#ff375f';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', COLS * CELL / 2, ROWS * CELL / 2 - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px monospace';
    ctx.fillText(`Score: ${this.#score}  ·  Click to restart`, COLS * CELL / 2, ROWS * CELL / 2 + 14);
  }

  _handleKey(e) {
    if (!document.activeElement || document.activeElement === document.body) {
      const map = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        if (!this.#alive) { this._start(); return; }
        // Prevent reversal
        if (d.x !== -this.#dir.x || d.y !== -this.#dir.y) this.#next = d;
      }
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  destroy() {
    clearInterval(this.#timer);
    window.removeEventListener('keydown', this._onKey);
  }
}
