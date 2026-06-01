/**
 * GSL Shell Parser — tokenizes and parses shell command lines.
 * Handles: pipes, I/O redirects, quoting, semicolons, && / ||
 */

export class Parser {
  parse(input) {
    const tokens = this._tokenize(input);
    return this._buildPipeline(tokens);
  }

  _tokenize(input) {
    const tokens = [];
    let i = 0;
    let cur = '';

    const flush = () => { if (cur) { tokens.push(cur); cur = ''; } };

    while (i < input.length) {
      const ch = input[i];

      if (ch === '"') {
        let j = i + 1;
        while (j < input.length && input[j] !== '"') {
          if (input[j] === '\\') j++;
          cur += input[j++];
        }
        i = j + 1;
      } else if (ch === "'") {
        let j = i + 1;
        while (j < input.length && input[j] !== "'") cur += input[j++];
        i = j + 1;
      } else if (ch === '\\') {
        cur += input[++i] ?? '';
        i++;
      } else if (ch === ' ' || ch === '\t') {
        flush();
        i++;
      } else if (ch === '|') {
        flush();
        tokens.push(input[i+1] === '|' ? '||' : '|');
        i += input[i+1] === '|' ? 2 : 1;
      } else if (ch === '&') {
        flush();
        tokens.push(input[i+1] === '&' ? '&&' : '&');
        i += input[i+1] === '&' ? 2 : 1;
      } else if (ch === ';') {
        flush();
        tokens.push(';');
        i++;
      } else if (ch === '>') {
        flush();
        tokens.push(input[i+1] === '>' ? '>>' : '>');
        i += input[i+1] === '>' ? 2 : 1;
      } else if (ch === '<') {
        flush();
        tokens.push('<');
        i++;
      } else {
        cur += ch;
        i++;
      }
    }
    flush();
    return tokens;
  }

  _buildPipeline(tokens) {
    const commands = [];
    let cmd = this._emptyCmd();
    let i = 0;

    while (i < tokens.length) {
      const tok = tokens[i];

      if (tok === '|') {
        commands.push(cmd);
        cmd = this._emptyCmd();
      } else if (tok === '>') {
        cmd.stdout_redirect = tokens[++i] ?? '';
      } else if (tok === '>>') {
        cmd.stdout_redirect = tokens[++i] ?? '';
        cmd.stdout_redirect_append = true;
      } else if (tok === '<') {
        cmd.stdin_redirect = tokens[++i] ?? '';
      } else {
        if (!cmd.name) cmd.name = tok;
        else cmd.args.push(tok);
      }
      i++;
    }

    if (cmd.name) commands.push(cmd);
    return commands;
  }

  _emptyCmd() {
    return { name: '', args: [], stdout_redirect: null, stderr_redirect: null, stdin_redirect: null };
  }
}
