/**
 * Terminal renderer — ANSI escape code parser + DOM output.
 * Renders into a scrollable div using spans for colored text.
 */

export class TerminalRenderer {
  #container;
  #output;
  #cursor;
  #currentLine;
  #fgColor = null;
  #bgColor = null;
  #bold    = false;

  constructor(container) {
    this.#container = container;

    this.#output = document.createElement('div');
    this.#output.style.cssText = [
      'font-family: var(--font-mono)',
      'font-size: 13px',
      'line-height: 1.5',
      'color: #cdd6f4',
      'white-space: pre-wrap',
      'word-break: break-all',
      'height: 100%',
      'overflow-y: auto',
      'outline: none',
    ].join(';');

    this.#currentLine = this._newLine();
    this.#output.appendChild(this.#currentLine);
    container.appendChild(this.#output);

    // Blinking cursor
    this.#cursor = document.createElement('span');
    this.#cursor.style.cssText = 'display:inline-block;width:8px;height:14px;background:#cdd6f4;margin-left:1px;vertical-align:text-bottom;animation:blink 1s step-end infinite;';
    const style = document.createElement('style');
    style.textContent = '@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }';
    document.head.appendChild(style);
    this.#currentLine.appendChild(this.#cursor);
  }

  write(text) {
    let i = 0;
    while (i < text.length) {
      if (text[i] === '\x1b' && text[i+1] === '[') {
        // ANSI CSI sequence
        let j = i + 2;
        while (j < text.length && !/[A-Za-z]/.test(text[j])) j++;
        const code = text.slice(i+2, j);
        const cmd  = text[j];
        this._handleAnsi(code, cmd);
        i = j + 1;
      } else if (text[i] === '\r') {
        this._carriageReturn();
        i++;
      } else if (text[i] === '\n') {
        this._lineFeed();
        i++;
      } else if (text[i] === '\b') {
        this.backspace();
        i++;
      } else {
        // Find next control char
        let j = i;
        while (j < text.length && text[j] !== '\x1b' && text[j] !== '\r' && text[j] !== '\n' && text[j] !== '\b') j++;
        const chunk = text.slice(i, j);
        if (chunk) this._appendText(chunk);
        i = j;
      }
    }
    this._scrollToBottom();
  }

  backspace() {
    // Remove cursor, remove last char span if empty, re-append cursor
    this.#cursor.remove();
    const children = Array.from(this.#currentLine.childNodes);
    for (let i = children.length - 1; i >= 0; i--) {
      const n = children[i];
      if (n.nodeType === Node.TEXT_NODE || n.tagName === 'SPAN') {
        const txt = n.textContent;
        if (txt.length > 1) { n.textContent = txt.slice(0, -1); break; }
        else { n.remove(); break; }
      }
    }
    this.#currentLine.appendChild(this.#cursor);
  }

  clear() {
    this.#output.innerHTML = '';
    this.#currentLine = this._newLine();
    this.#output.appendChild(this.#currentLine);
    this.#currentLine.appendChild(this.#cursor);
  }

  _handleAnsi(code, cmd) {
    if (cmd === 'm') {
      // SGR — graphics
      const parts = code.split(';').map(Number);
      for (const n of parts) {
        if (n === 0)  { this.#fgColor = null; this.#bgColor = null; this.#bold = false; }
        else if (n === 1)  this.#bold = true;
        else if (n >= 30 && n <= 37) this.#fgColor = ANSI_COLORS[n - 30];
        else if (n >= 90 && n <= 97) this.#fgColor = ANSI_COLORS_BRIGHT[n - 90];
        else if (n >= 40 && n <= 47) this.#bgColor = ANSI_COLORS[n - 40];
        else if (n === 39) this.#fgColor = null;
        else if (n === 49) this.#bgColor = null;
      }
    } else if (cmd === 'J') {
      if (code === '2' || code === '') this.clear();
    } else if (cmd === 'H') {
      // Cursor home
    } else if (cmd === 'K') {
      // Erase line — simplistic
    }
  }

  _appendText(text) {
    this.#cursor.remove();
    const span = document.createElement('span');
    span.textContent = text;
    if (this.#fgColor) span.style.color = this.#fgColor;
    if (this.#bgColor) span.style.background = this.#bgColor;
    if (this.#bold)    span.style.fontWeight = 'bold';
    this.#currentLine.appendChild(span);
    this.#currentLine.appendChild(this.#cursor);
  }

  _carriageReturn() {
    // Move to start of line — for simplicity just continue
  }

  _lineFeed() {
    this.#cursor.remove();
    this.#currentLine = this._newLine();
    this.#output.appendChild(this.#currentLine);
    this.#currentLine.appendChild(this.#cursor);
  }

  _newLine() {
    const div = document.createElement('div');
    div.style.minHeight = '1.5em';
    return div;
  }

  _scrollToBottom() {
    this.#output.scrollTop = this.#output.scrollHeight;
  }

  destroy() {}
}

const ANSI_COLORS = ['#1e1e2e','#f38ba8','#a6e3a1','#f9e2af','#89b4fa','#cba6f7','#89dceb','#cdd6f4'];
const ANSI_COLORS_BRIGHT = ['#585b70','#f38ba8','#a6e3a1','#f9e2af','#89b4fa','#cba6f7','#89dceb','#ffffff'];
