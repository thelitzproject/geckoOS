/**
 * geckoOS Terminal — powered by GSL shell
 * Implements a VT100/ANSI terminal emulator in Canvas/DOM.
 */

import { TerminalRenderer } from './renderer.js';

export default class TerminalApp {
  #kernel;
  #win;
  #session;
  #renderer;
  #inputBuffer = '';
  #historyIdx  = -1;

  constructor(kernel, win) {
    this.#kernel = kernel;
    this.#win    = win;
    win.setTitle('Terminal — gsh');
  }

  async mount(container) {
    container.style.cssText = 'background:#1e1e2e;height:100%;display:flex;flex-direction:column;';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 12px;background:#181825;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0';
    toolbar.innerHTML = `
      <button class="term-tab active" style="font-size:12px;padding:2px 10px;background:rgba(255,255,255,0.1);border-radius:4px;color:#cdd6f4;border:none;cursor:pointer">gsh</button>
      <button id="term-new-tab" style="font-size:18px;line-height:1;background:none;border:none;color:#585b70;cursor:pointer;padding:0 4px">+</button>`;
    this.#win.addToolbar(toolbar);

    // Terminal canvas area
    const termWrap = document.createElement('div');
    termWrap.style.cssText = 'flex:1;overflow:hidden;padding:8px;box-sizing:border-box;';
    container.appendChild(termWrap);

    // Init renderer
    this.#renderer = new TerminalRenderer(termWrap);

    // Spawn GSL shell session
    this.#session = await this.#kernel.gsl.spawnShell({ cwd: '/home/user' });

    // Show MOTD
    try {
      const motd = await this.#kernel.gsl.fs.readFile('/etc/motd');
      this.#renderer.write(motd);
    } catch {}

    // Show initial prompt
    this._showPrompt();

    // Keyboard input
    termWrap.setAttribute('tabindex', '0');
    termWrap.addEventListener('click', () => termWrap.focus());

    termWrap.addEventListener('keydown', async e => {
      e.preventDefault();
      await this._handleKey(e);
    });

    // Focus on mount
    setTimeout(() => termWrap.focus(), 100);
  }

  async _handleKey(e) {
    const { key, ctrlKey } = e;

    if (ctrlKey && key === 'c') {
      this.#renderer.write('^C\r\n');
      this.#inputBuffer = '';
      this._showPrompt();
      return;
    }

    if (ctrlKey && key === 'l') {
      this.#renderer.clear();
      this._showPrompt();
      return;
    }

    if (key === 'Enter') {
      this.#renderer.write('\r\n');
      const cmd = this.#inputBuffer.trim();
      this.#inputBuffer = '';
      this.#historyIdx = -1;

      if (cmd) {
        const result = await this.#session.exec(cmd);
        if (result.stdout) this.#renderer.write(result.stdout);
        if (result.stderr) this.#renderer.write('\x1b[31m' + result.stderr + '\x1b[0m');
      }
      this._showPrompt();

    } else if (key === 'Backspace') {
      if (this.#inputBuffer.length > 0) {
        this.#inputBuffer = this.#inputBuffer.slice(0, -1);
        this.#renderer.backspace();
      }

    } else if (key === 'ArrowUp') {
      const hist = this.#session.history;
      if (this.#historyIdx < hist.length - 1) {
        this.#historyIdx++;
        this._replaceInput(hist[hist.length - 1 - this.#historyIdx]);
      }

    } else if (key === 'ArrowDown') {
      if (this.#historyIdx > 0) {
        this.#historyIdx--;
        this._replaceInput(this.#session.history[this.#session.history.length - 1 - this.#historyIdx]);
      } else if (this.#historyIdx === 0) {
        this.#historyIdx = -1;
        this._replaceInput('');
      }

    } else if (key === 'Tab') {
      // Basic tab completion
      const partial = this.#inputBuffer.split(' ').pop();
      const completions = await this._complete(partial);
      if (completions.length === 1) {
        const add = completions[0].slice(partial.length);
        this.#inputBuffer += add;
        this.#renderer.write(add);
      } else if (completions.length > 1) {
        this.#renderer.write('\r\n' + completions.join('  ') + '\r\n');
        this._showPrompt();
        this.#renderer.write(this.#inputBuffer);
      }

    } else if (key.length === 1) {
      this.#inputBuffer += key;
      this.#renderer.write(key);
    }
  }

  async _complete(partial) {
    if (!partial) return [];
    const allCmds = ['ls','cd','cat','mkdir','rm','mv','cp','touch','echo','grep',
      'head','tail','wc','sort','uniq','tr','export','env','ps','kill',
      'apt','curl','wget','date','whoami','hostname','uname','clear','help'];

    if (!partial.includes('/')) {
      return allCmds.filter(c => c.startsWith(partial));
    }

    // Path completion
    const dir  = partial.includes('/') ? partial.slice(0, partial.lastIndexOf('/') + 1) : '';
    const base = partial.includes('/') ? partial.slice(partial.lastIndexOf('/') + 1)    : partial;
    try {
      const absDir = this.#kernel.gsl.fs.resolve(this.#session.cwd, dir || '.');
      const entries = await this.#kernel.gsl.fs.readdir(absDir);
      return entries.filter(e => e.startsWith(base)).map(e => dir + e);
    } catch {
      return [];
    }
  }

  _replaceInput(text) {
    // Clear current input visually
    for (let i = 0; i < this.#inputBuffer.length; i++) this.#renderer.backspace();
    this.#inputBuffer = text;
    this.#renderer.write(text);
  }

  _showPrompt() {
    this.#renderer.write(this.#session.getPrompt());
  }

  destroy() {
    this.#renderer?.destroy();
  }
}
