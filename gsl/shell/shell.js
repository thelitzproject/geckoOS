/**
 * GSL Shell — bash-compatible command interpreter.
 * Supports: pipes, redirects, env vars, builtins, job control.
 */

import { Builtins } from './builtins.js';
import { Parser }   from './parser.js';

export class Shell {
  #gsl;
  #sessions = new Map();
  #nextSid  = 1;

  constructor(gsl) {
    this.#gsl = gsl;
  }

  createSession(opts = {}) {
    const sid = this.#nextSid++;
    const session = new ShellSession(sid, this.#gsl, {
      cwd:  opts.cwd  ?? '/home/user',
      user: opts.user ?? 'user',
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin:/sbin',
        HOME: opts.cwd ?? '/home/user',
        USER: opts.user ?? 'user',
        SHELL: '/bin/gsh',
        TERM: 'xterm-256color',
        GECKO_VERSION: '1.0.0',
        GSL_VERSION: this.#gsl.version,
        ...opts.env,
      },
    });
    this.#sessions.set(sid, session);
    return session;
  }

  destroySession(sid) {
    this.#sessions.delete(sid);
  }
}

export class ShellSession {
  #gsl;
  #builtins;
  #parser;

  constructor(id, gsl, opts) {
    this.id   = id;
    this.#gsl = gsl;
    this.cwd  = opts.cwd;
    this.user = opts.user;
    this.env  = { ...opts.env };
    this.history = [];
    this.#builtins = new Builtins(this, gsl);
    this.#parser   = new Parser();
    this._ioBridge = null; // set by terminal app
  }

  /** Execute a command string, return { stdout, stderr, code } */
  async exec(input, opts = {}) {
    const trimmed = input.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return { stdout: '', stderr: '', code: 0 };
    }

    this.history.push(trimmed);

    try {
      const pipeline = this.#parser.parse(trimmed);
      return await this._runPipeline(pipeline, opts);
    } catch (e) {
      return { stdout: '', stderr: `gsh: ${e.message}\n`, code: 1 };
    }
  }

  async _runPipeline(pipeline, opts) {
    let prevStdout = opts.stdin ?? '';
    let lastResult = { stdout: '', stderr: '', code: 0 };

    for (const cmd of pipeline) {
      const result = await this._runCommand(cmd, prevStdout);
      if (cmd.stderr_redirect) {
        await this.#gsl.fs.appendFile(
          this.#gsl.fs.resolve(this.cwd, cmd.stderr_redirect),
          result.stderr
        );
        result.stderr = '';
      }
      if (cmd.stdout_redirect) {
        const fPath = this.#gsl.fs.resolve(this.cwd, cmd.stdout_redirect);
        if (cmd.stdout_redirect_append) {
          await this.#gsl.fs.appendFile(fPath, result.stdout);
        } else {
          await this.#gsl.fs.writeFile(fPath, result.stdout, { recursive: true });
        }
        result.stdout = '';
      }
      prevStdout = result.stdout;
      lastResult = result;
    }

    return lastResult;
  }

  async _runCommand(cmd, stdin) {
    const name = this._expandVars(cmd.name);
    const args = cmd.args.map(a => this._expandVars(a));

    // Builtin?
    if (this.#builtins.has(name)) {
      return this.#builtins.run(name, args, stdin);
    }

    // Try to find in PATH
    const bin = await this._resolveBin(name);
    if (bin) {
      return this._execBinary(bin, args, stdin);
    }

    return { stdout: '', stderr: `gsh: ${name}: command not found\n`, code: 127 };
  }

  async _resolveBin(name) {
    if (name.startsWith('/') || name.startsWith('./') || name.startsWith('../')) {
      const abs = this.#gsl.fs.resolve(this.cwd, name);
      return (await this.#gsl.fs.exists(abs)) ? abs : null;
    }

    const paths = (this.env.PATH ?? '/usr/bin:/bin').split(':');
    for (const dir of paths) {
      const full = `${dir}/${name}`;
      if (await this.#gsl.fs.exists(full)) return full;
    }
    return null;
  }

  async _execBinary(path, args, stdin) {
    try {
      const src = await this.#gsl.fs.readFile(path);
      // Script shebang handling
      if (src.startsWith('#!/')) {
        const firstLine = src.split('\n')[0];
        const interp = firstLine.slice(2).trim().split(' ');
        return this._runCommand({
          name: interp[0],
          args: [...interp.slice(1), path, ...args],
        }, stdin);
      }
      // Treat as shell script
      const lines = src.split('\n');
      let out = '';
      for (const line of lines) {
        const r = await this.exec(line, { stdin });
        out += r.stdout;
        if (r.code !== 0) return { stdout: out, stderr: r.stderr, code: r.code };
      }
      return { stdout: out, stderr: '', code: 0 };
    } catch (e) {
      return { stdout: '', stderr: `${path}: ${e.message}\n`, code: 1 };
    }
  }

  _expandVars(str) {
    return str.replace(/\$\{?([A-Z_][A-Z_0-9]*)\}?/gi, (_, name) => this.env[name] ?? '');
  }

  /** Change working directory — returns error string or null */
  async cd(path) {
    const target = this.#gsl.fs.resolve(this.cwd, path ?? this.env.HOME ?? '/home/user');
    try {
      const stat = await this.#gsl.fs.stat(target);
      if (stat.type !== 'dir') return `cd: not a directory: ${path}`;
      this.cwd = target;
      return null;
    } catch {
      return `cd: no such file or directory: ${path}`;
    }
  }

  getPrompt() {
    const home = this.env.HOME ?? '/home/user';
    const cwd  = this.cwd.startsWith(home)
      ? '~' + this.cwd.slice(home.length)
      : this.cwd;
    const symbol = this.user === 'root' ? '#' : '$';
    return `\x1b[32m${this.user}@gecko\x1b[0m:\x1b[34m${cwd}\x1b[0m${symbol} `;
  }
}
