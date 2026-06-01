/**
 * geckoOS OOBE — Out-of-Box Experience (ChromeOS-style setup wizard)
 */

const STEPS = ['welcome', 'personalize', 'name', 'done'];

const ACCENTS = [
  '#007aff', '#34c759', '#ff9f0a', '#ff375f',
  '#bf5af2', '#00c7be', '#ff6b35', '#636366',
];

export class OOBE {
  #kernel;
  #el;
  #step = 0;
  #resolve;
  #data = {
    theme:  'dark',
    accent: '#007aff',
    name:   '',
  };

  constructor(kernel) {
    this.#kernel = kernel;
    this.#el = document.getElementById('oobe-overlay');
  }

  /** Returns a promise that resolves when setup is complete */
  run() {
    return new Promise(resolve => {
      this.#resolve = resolve;
      this.#el.hidden = false;
      this._render();
    });
  }

  _render() {
    this.#el.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'oobe-card';

    const logo = document.createElement('img');
    logo.src = 'assets/icons/system/gecko-mark.svg';
    logo.className = 'oobe-logo';
    logo.alt = 'geckoOS';
    card.appendChild(logo);

    const step = STEPS[this.#step];
    if      (step === 'welcome')     this._stepWelcome(card);
    else if (step === 'personalize') this._stepPersonalize(card);
    else if (step === 'name')        this._stepName(card);
    else if (step === 'done')        this._stepDone(card);

    this.#el.appendChild(card);
  }

  _footer(card, { back = false, nextLabel = 'Continue', onNext } = {}) {
    const footer = document.createElement('div');
    footer.className = 'oobe-footer';

    const dots = document.createElement('div');
    dots.className = 'oobe-dots';
    STEPS.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'oobe-dot' + (i === this.#step ? ' active' : '');
      dots.appendChild(d);
    });

    const btnWrap = document.createElement('div');

    if (back && this.#step > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'oobe-btn oobe-btn-secondary';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', () => { this.#step--; this._render(); });
      btnWrap.appendChild(backBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'oobe-btn oobe-btn-primary';
    nextBtn.textContent = nextLabel;
    nextBtn.addEventListener('click', () => onNext ? onNext() : this._advance());
    btnWrap.appendChild(nextBtn);

    footer.append(dots, btnWrap);
    card.appendChild(footer);
  }

  _headline(card, text) {
    const h = document.createElement('div');
    h.className = 'oobe-headline';
    h.textContent = text;
    card.appendChild(h);
  }

  _sub(card, text) {
    const s = document.createElement('div');
    s.className = 'oobe-sub';
    s.textContent = text;
    card.appendChild(s);
  }

  _stepWelcome(card) {
    this._headline(card, 'Welcome to geckoOS');
    this._sub(card, 'A fast, modern desktop experience in your browser.\nLet\'s take a moment to set things up.');

    const body = document.createElement('div');
    body.className = 'oobe-body';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:8px;text-align:center;';
    label.textContent = 'LANGUAGE';
    body.appendChild(label);

    const sel = document.createElement('select');
    sel.className = 'oobe-select';
    sel.innerHTML = '<option value="en">English (United States)</option>';
    body.appendChild(sel);

    card.appendChild(body);
    this._footer(card, { nextLabel: 'Get Started' });
  }

  _stepPersonalize(card) {
    this._headline(card, 'Make it yours');
    this._sub(card, 'Choose how geckoOS looks and feels.');

    const body = document.createElement('div');
    body.className = 'oobe-body';

    // Theme selector
    const themeRow = document.createElement('div');
    themeRow.className = 'oobe-theme-row';

    for (const theme of ['light', 'dark']) {
      const opt = document.createElement('div');
      opt.className = 'oobe-theme-opt' + (this.#data.theme === theme ? ' active' : '');
      opt.innerHTML = `
        <div class="oobe-theme-preview ${theme}">
          <div class="oobe-theme-bar"></div>
        </div>
        <div class="oobe-theme-label">${theme === 'light' ? 'Light' : 'Dark'}</div>`;
      opt.addEventListener('click', () => {
        this.#data.theme = theme;
        themeRow.querySelectorAll('.oobe-theme-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        document.documentElement.setAttribute('data-theme', theme);
      });
      themeRow.appendChild(opt);
    }
    body.appendChild(themeRow);

    // Accent label
    const accentLabel = document.createElement('div');
    accentLabel.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:12px;text-align:center;';
    accentLabel.textContent = 'ACCENT COLOR';
    body.appendChild(accentLabel);

    // Accent swatches
    const accentRow = document.createElement('div');
    accentRow.className = 'oobe-accent-row';
    for (const color of ACCENTS) {
      const sw = document.createElement('div');
      sw.className = 'oobe-accent-swatch' + (this.#data.accent === color ? ' active' : '');
      sw.style.background = color;
      sw.addEventListener('click', () => {
        this.#data.accent = color;
        accentRow.querySelectorAll('.oobe-accent-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        document.documentElement.style.setProperty('--color-accent', color);
      });
      accentRow.appendChild(sw);
    }
    body.appendChild(accentRow);
    card.appendChild(body);

    this._footer(card, { back: true });
  }

  _stepName(card) {
    this._headline(card, 'What should we call you?');
    this._sub(card, 'Your name appears in the menu bar and personalises your experience.');

    const body = document.createElement('div');
    body.className = 'oobe-body';

    const input = document.createElement('input');
    input.className = 'oobe-name-input';
    input.type = 'text';
    input.placeholder = 'Enter your name';
    input.maxLength = 32;
    input.value = this.#data.name;
    input.addEventListener('input', () => { this.#data.name = input.value.trim(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') this._advance(); });
    body.appendChild(input);
    card.appendChild(body);

    this._footer(card, { back: true });
    setTimeout(() => input.focus(), 50);
  }

  _stepDone(card) {
    const check = document.createElement('div');
    check.className = 'oobe-check';
    check.textContent = '✓';
    card.appendChild(check);

    const name = this.#data.name || 'there';
    this._headline(card, `You're all set, ${name}!`);
    this._sub(card, 'geckoOS is ready to use. Enjoy your new desktop.');

    const body = document.createElement('div');
    body.className = 'oobe-body';
    card.appendChild(body);

    this._footer(card, {
      nextLabel: 'Explore geckoOS',
      onNext: () => this._complete(),
    });
  }

  _advance() {
    this.#step++;
    this._render();
  }

  _complete() {
    const k = this.#kernel;
    k.settings.set('appearance.theme',  this.#data.theme);
    k.settings.set('appearance.accentColor', this.#data.accent);
    if (this.#data.name) k.settings.set('user.name', this.#data.name);
    k.settings.set('oobe.completed', true);

    this.#el.style.transition = 'opacity 500ms ease';
    this.#el.style.opacity = '0';
    setTimeout(() => {
      this.#el.hidden = true;
      this.#resolve();
    }, 500);
  }
}
