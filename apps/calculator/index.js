export default class CalculatorApp {
  #kernel; #win; #display; #expr = ''; #result = '0'; #keyHandler;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('Calculator');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#1c1c1e;';

    this.#display = document.createElement('div');
    this.#display.style.cssText = 'padding:20px 18px 8px;text-align:right;flex-shrink:0;';
    this.#display.innerHTML = `
      <div id="calc-expr" style="font-size:14px;color:rgba(255,255,255,0.5);min-height:20px;"></div>
      <div id="calc-result" style="font-size:52px;font-weight:200;color:#fff;line-height:1.1;">0</div>`;

    const keypad = document.createElement('div');
    keypad.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.1);flex:1;';

    const KEYS = [
      ['AC','±','%','÷'],
      ['7','8','9','×'],
      ['4','5','6','−'],
      ['1','2','3','+'],
      ['0','·','='],
    ];

    for (const row of KEYS) {
      for (let i = 0; i < row.length; i++) {
        const label = row[i];
        const btn = document.createElement('button');
        btn.textContent = label;

        const isOp  = ['÷','×','−','+','='].includes(label);
        const isTop = ['AC','±','%'].includes(label);
        const isWide = label === '0';

        btn.style.cssText = [
          'font-size:22px',
          'font-weight:300',
          'border:none',
          'cursor:pointer',
          'transition:filter 80ms',
          `background:${isOp ? '#ff9f0a' : isTop ? '#636366' : '#3a3a3c'}`,
          `color:${isOp ? '#fff' : isTop ? '#fff' : '#fff'}`,
          isWide ? 'grid-column:span 2;text-align:left;padding-left:28px' : '',
        ].join(';');

        btn.addEventListener('mousedown', () => btn.style.filter = 'brightness(1.3)');
        btn.addEventListener('mouseup',   () => btn.style.filter = '');
        btn.addEventListener('click',     () => this._press(label));
        keypad.appendChild(btn);
      }
    }

    container.append(this.#display, keypad);

    document.addEventListener('keydown', this.#keyHandler = e => {
      const map = {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        '.':'·','+':'+','-':'−','*':'×','/':'÷','Enter':'=','Backspace':'⌫','Escape':'AC'};
      if (map[e.key]) this._press(map[e.key]);
    });
  }

  _press(k) {
    const exprEl  = this.#display.querySelector('#calc-expr');
    const resultEl = this.#display.querySelector('#calc-result');

    if (k === 'AC') { this.#expr = ''; this.#result = '0'; }
    else if (k === '⌫') { this.#expr = this.#expr.slice(0,-1); }
    else if (k === '±') {
      try { this.#result = String(-eval(this.#result)); this.#expr = ''; }
      catch {}
    }
    else if (k === '%') {
      try { this.#result = String(eval(this.#expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')) / 100); this.#expr = ''; }
      catch {}
    }
    else if (k === '=') {
      try {
        const safe = this.#expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/·/g,'.');
        this.#result = String(Function('"use strict";return (' + safe + ')')());
        exprEl.textContent = this.#expr;
        this.#expr = '';
      } catch { this.#result = 'Error'; this.#expr = ''; }
    }
    else { this.#expr += k; }

    exprEl.textContent  = this.#expr;
    const disp = this.#expr || this.#result;
    resultEl.textContent = disp.length > 9 ? parseFloat(disp).toExponential(3) : disp;
  }

  destroy() {
    document.removeEventListener('keydown', this.#keyHandler);
  }
}
