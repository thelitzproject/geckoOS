/**
 * Breakout — classic brick-breaker arcade game
 */
const W = 480, H = 400;
const PADDLE_W = 80, PADDLE_H = 10, PADDLE_Y = H - 30;
const BALL_R = 7;
const BRICK_COLS = 10, BRICK_ROWS = 5;
const BRICK_W = 42, BRICK_H = 16, BRICK_PAD = 2;
const BRICK_OFFSET_X = (W - BRICK_COLS * (BRICK_W + BRICK_PAD)) / 2;
const BRICK_OFFSET_Y = 40;

const ROW_COLORS = ['#ff375f','#ff9f0a','#ffd60a','#34c759','#007aff'];

export default class BreakoutApp {
  #kernel; #win;
  #canvas; #ctx;
  #paddle = W / 2;
  #ball; #vel;
  #bricks = [];
  #score = 0; #lives = 3;
  #state = 'idle'; // idle | playing | paused | won | lost
  #raf = null;
  #keys = {};
  #scoreEl;
  #highScore = 0;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    this.#highScore = parseInt(localStorage.getItem('gecko.breakout.best') || '0', 10);
    win.setTitle('Breakout');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0d0d1f;gap:10px;';

    this.#scoreEl = document.createElement('div');
    this.#scoreEl.style.cssText = 'color:#fff;font-size:14px;font-family:monospace;letter-spacing:1px;';
    container.appendChild(this.#scoreEl);

    this.#canvas = document.createElement('canvas');
    this.#canvas.width  = W;
    this.#canvas.height = H;
    this.#canvas.style.cssText = 'border-radius:8px;cursor:none;';
    this.#ctx = this.#canvas.getContext('2d');
    container.appendChild(this.#canvas);

    const hint = document.createElement('div');
    hint.style.cssText = 'color:rgba(255,255,255,0.3);font-size:12px;font-family:monospace;';
    hint.textContent = 'Mouse or ← → to move · Space to launch · Click canvas to start';
    container.appendChild(hint);

    this.#canvas.addEventListener('click', () => { if (this.#state !== 'playing') this._start(); });
    this.#canvas.addEventListener('mousemove', e => {
      const rect = this.#canvas.getBoundingClientRect();
      this.#paddle = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, e.clientX - rect.left));
      if (this.#state === 'idle' || this.#state === 'paused') this._drawIdle();
    });

    this._onKey = e => {
      this.#keys[e.code] = e.type === 'keydown';
      if (e.code === 'Space' && this.#state !== 'playing') { e.preventDefault(); this._start(); }
      if (e.code === 'Space') e.preventDefault();
    };
    window.addEventListener('keydown',  this._onKey);
    window.addEventListener('keyup',    this._onKey);

    this._drawIdle();
    this._updateScore();
  }

  _start() {
    this.#score  = 0;
    this.#lives  = 3;
    this.#paddle = W / 2;
    this._buildBricks();
    this._resetBall();
    this.#state  = 'playing';
    cancelAnimationFrame(this.#raf);
    this._loop();
  }

  _buildBricks() {
    this.#bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        this.#bricks.push({
          x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD),
          y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD),
          alive: true, row: r,
        });
      }
    }
  }

  _resetBall() {
    this.#ball = { x: W / 2, y: H - 60 };
    const angle = (Math.random() * 60 + 60) * (Math.PI / 180) * (Math.random() < 0.5 ? 1 : -1);
    const speed = 4.5;
    this.#vel  = { x: Math.cos(angle) * speed, y: -Math.abs(Math.sin(angle)) * speed };
  }

  _loop() {
    this.#raf = requestAnimationFrame(() => this._loop());

    // Keyboard paddle
    if (this.#keys['ArrowLeft'])  this.#paddle = Math.max(PADDLE_W / 2, this.#paddle - 6);
    if (this.#keys['ArrowRight']) this.#paddle = Math.min(W - PADDLE_W / 2, this.#paddle + 6);

    this._update();
    this._draw();
  }

  _update() {
    const b = this.#ball;
    b.x += this.#vel.x;
    b.y += this.#vel.y;

    // Wall bounce
    if (b.x - BALL_R < 0)  { b.x = BALL_R;  this.#vel.x *= -1; }
    if (b.x + BALL_R > W)  { b.x = W - BALL_R; this.#vel.x *= -1; }
    if (b.y - BALL_R < 0)  { b.y = BALL_R;  this.#vel.y *= -1; }

    // Paddle
    const px = this.#paddle, py = PADDLE_Y;
    if (b.y + BALL_R >= py && b.y + BALL_R <= py + PADDLE_H + Math.abs(this.#vel.y) &&
        b.x >= px - PADDLE_W / 2 && b.x <= px + PADDLE_W / 2) {
      const offset = (b.x - px) / (PADDLE_W / 2);
      const angle  = offset * 60 * (Math.PI / 180);
      const speed  = Math.hypot(this.#vel.x, this.#vel.y);
      this.#vel.x  = Math.sin(angle) * speed;
      this.#vel.y  = -Math.abs(Math.cos(angle) * speed);
      b.y = py - BALL_R;
    }

    // Bottom — lose life
    if (b.y - BALL_R > H) {
      this.#lives--;
      if (this.#lives <= 0) {
        this.#state = 'lost';
        cancelAnimationFrame(this.#raf);
        if (this.#score > this.#highScore) {
          this.#highScore = this.#score;
          localStorage.setItem('gecko.breakout.best', this.#highScore);
        }
        this._draw();
        return;
      }
      this._resetBall();
    }

    // Brick collisions
    for (const brick of this.#bricks) {
      if (!brick.alive) continue;
      if (b.x + BALL_R > brick.x && b.x - BALL_R < brick.x + BRICK_W &&
          b.y + BALL_R > brick.y && b.y - BALL_R < brick.y + BRICK_H) {
        brick.alive = false;
        this.#score += (BRICK_ROWS - brick.row) * 10;
        // Determine bounce axis
        const overlapX = Math.min(b.x + BALL_R - brick.x, brick.x + BRICK_W - (b.x - BALL_R));
        const overlapY = Math.min(b.y + BALL_R - brick.y, brick.y + BRICK_H - (b.y - BALL_R));
        if (overlapX < overlapY) this.#vel.x *= -1; else this.#vel.y *= -1;
        break;
      }
    }

    // Win check
    if (this.#bricks.every(b => !b.alive)) {
      this.#state = 'won';
      cancelAnimationFrame(this.#raf);
      if (this.#score > this.#highScore) {
        this.#highScore = this.#score;
        localStorage.setItem('gecko.breakout.best', this.#highScore);
      }
      this._draw();
    }
  }

  _draw() {
    const ctx = this.#ctx;
    ctx.fillStyle = '#0d0d1f';
    ctx.fillRect(0, 0, W, H);

    // Bricks
    for (const brick of this.#bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = ROW_COLORS[brick.row];
      ctx.beginPath(); ctx.roundRect(brick.x, brick.y, BRICK_W, BRICK_H, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(brick.x, brick.y, BRICK_W, 3);
    }

    // Paddle
    const grad = ctx.createLinearGradient(this.#paddle - PADDLE_W / 2, 0, this.#paddle + PADDLE_W / 2, 0);
    grad.addColorStop(0, '#007aff');
    grad.addColorStop(1, '#34c759');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(this.#paddle - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 5); ctx.fill();

    // Ball
    if (this.#state === 'playing' || this.#state === 'won' || this.#state === 'lost') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.#ball.x, this.#ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();

      // Trail glow
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(this.#ball.x - this.#vel.x * 2, this.#ball.y - this.#vel.y * 2, BALL_R * 0.8, 0, Math.PI * 2); ctx.fill();
    }

    // Lives
    for (let i = 0; i < this.#lives; i++) {
      ctx.fillStyle = '#ff375f';
      ctx.beginPath(); ctx.arc(12 + i * 18, H - 8, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Overlays
    if (this.#state === 'idle') this._overlay('BREAKOUT', 'Click or press Space to play');
    if (this.#state === 'won')  this._overlay('YOU WIN! 🎉', `Score: ${this.#score} · Click to play again`);
    if (this.#state === 'lost') this._overlay('GAME OVER', `Score: ${this.#score} · Click to try again`);

    this._updateScore();
  }

  _drawIdle() { this._draw(); }

  _overlay(title, sub) {
    const ctx = this.#ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 14);
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(sub, W / 2, H / 2 + 14);
  }

  _updateScore() {
    this.#scoreEl.textContent = `Score: ${this.#score}   Lives: ${'❤️'.repeat(this.#lives)}   Best: ${this.#highScore}`;
  }

  destroy() {
    cancelAnimationFrame(this.#raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup',   this._onKey);
  }
}
