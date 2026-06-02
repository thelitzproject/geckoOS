/**
 * TextPad — plain text / code editor with line numbers
 */
import { FilePicker } from '../../ui/components/file-picker.js';

export default class TextPadApp {
  #kernel;
  #win;
  #editor;
  #lineNums;
  #filePath = null;
  #dirty    = false;
  #statusEl;
  #picker;

  constructor(kernel, win, args) {
    this.#kernel   = kernel;
    this.#win      = win;
    this.#filePath = args?.path ?? null;
    this.#picker   = new FilePicker(kernel);
    win.setTitle(this.#filePath ? this.#filePath.split('/').pop() : 'Untitled — TextPad');
  }

  async mount(container) {
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 12px;background:var(--color-surface-2);border-bottom:0.5px solid var(--color-separator);flex-shrink:0;font-size:12px;';

    const saveBtn    = this._btn('Save',    () => this._save());
    const saveAsBtn  = this._btn('Save As…',() => this._saveAs());
    const openBtn    = this._btn('Open…',   () => this._open());

    this.#statusEl = document.createElement('span');
    this.#statusEl.style.cssText = 'margin-left:auto;color:var(--color-text-tertiary);';

    toolbar.append(saveBtn, saveAsBtn, openBtn, this.#statusEl);
    this.#win.addToolbar(toolbar);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;display:flex;overflow:hidden;';

    this.#lineNums = document.createElement('div');
    this.#lineNums.style.cssText = 'width:40px;background:var(--color-surface-2);color:var(--color-text-tertiary);font-family:var(--font-mono);font-size:13px;line-height:1.6;padding:12px 0;text-align:right;padding-right:8px;overflow:hidden;flex-shrink:0;user-select:none;';

    this.#editor = document.createElement('textarea');
    this.#editor.style.cssText = [
      'flex:1', 'font-family:var(--font-mono)', 'font-size:13px', 'line-height:1.6',
      'padding:12px', 'resize:none', 'border:none', 'outline:none',
      'background:var(--color-window-bg)', 'color:var(--color-text-primary)',
      'tab-size:2', '-webkit-tab-size:2', 'white-space:pre',
    ].join(';');
    this.#editor.spellcheck = false;

    this.#editor.addEventListener('input', () => {
      this.#dirty = true;
      this._updateTitle();
      this._updateLineNums();
      this._updateStatus();
    });

    this.#editor.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        e.shiftKey ? this._saveAs() : this._save();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = this.#editor.selectionStart;
        const v = this.#editor.value;
        this.#editor.value = v.slice(0, s) + '  ' + v.slice(s);
        this.#editor.selectionStart = this.#editor.selectionEnd = s + 2;
      }
    });

    this.#editor.addEventListener('scroll', () => {
      this.#lineNums.scrollTop = this.#editor.scrollTop;
    });

    this.#editor.addEventListener('click',  () => this._updateStatus());
    this.#editor.addEventListener('keyup',  () => this._updateStatus());

    wrap.append(this.#lineNums, this.#editor);
    container.appendChild(wrap);

    if (this.#filePath) {
      await this._loadFile(this.#filePath);
    } else {
      this._updateLineNums();
      this._updateStatus();
    }
  }

  _btn(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'padding:3px 10px;background:var(--color-surface-3);border:0.5px solid var(--color-border);border-radius:5px;cursor:pointer;color:var(--color-text-primary);';
    btn.addEventListener('click', action);
    return btn;
  }

  async _loadFile(path) {
    try {
      const content = await this.#kernel.gsl.fs.readFile(path);
      this.#editor.value = content;
      this.#filePath = path;
      this.#dirty = false;
      this._updateTitle();
      this._updateLineNums();
      this._updateStatus();
    } catch (e) {
      this.#kernel.notify('TextPad', `Cannot open file: ${e.message}`);
    }
  }

  async _save() {
    if (!this.#filePath) { await this._saveAs(); return; }
    try {
      await this.#kernel.gsl.fs.writeFile(this.#filePath, this.#editor.value, { recursive: true });
      this.#dirty = false;
      this._updateTitle();
      this.#kernel.notify('TextPad', `Saved: ${this.#filePath.split('/').pop()}`);
    } catch (e) {
      this.#kernel.notify('TextPad', `Save failed: ${e.message}`);
    }
  }

  async _saveAs() {
    const fname = this.#filePath?.split('/').pop() ?? 'untitled.txt';
    const startDir = this.#filePath
      ? this.#filePath.split('/').slice(0, -1).join('/') || '/home/user'
      : '/home/user';
    const path = await this.#picker.open({ mode: 'save', filename: fname, startDir });
    if (!path) return;
    this.#filePath = path;
    await this._save();
  }

  async _open() {
    const path = await this.#picker.open({ mode: 'open', startDir: '/home/user' });
    if (path) await this._loadFile(path);
  }

  _updateTitle() {
    const name = this.#filePath ? this.#filePath.split('/').pop() : 'Untitled';
    this.#win.setTitle(`${this.#dirty ? '• ' : ''}${name} — TextPad`);
  }

  _updateLineNums() {
    const count = (this.#editor.value.match(/\n/g) ?? []).length + 1;
    this.#lineNums.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  }

  _updateStatus() {
    const v   = this.#editor.value;
    const pos = this.#editor.selectionStart;
    const line = (v.slice(0, pos).match(/\n/g) ?? []).length + 1;
    const chars = v.length;
    const words = v.trim().split(/\s+/).filter(Boolean).length;
    this.#statusEl.textContent = `Ln ${line}  ·  ${chars} chars  ·  ${words} words`;
  }

  destroy() {}
}
