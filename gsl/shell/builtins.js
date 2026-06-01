/**
 * GSL Shell Builtins — POSIX-style commands implemented in JS.
 */

export class Builtins {
  #session;
  #gsl;
  #cmds;

  constructor(session, gsl) {
    this.#session = session;
    this.#gsl = gsl;
    this.#cmds = this._register();
  }

  has(name) { return this.#cmds.has(name); }

  async run(name, args, stdin) {
    const fn = this.#cmds.get(name);
    try {
      const result = await fn(args, stdin);
      return typeof result === 'string'
        ? { stdout: result, stderr: '', code: 0 }
        : result;
    } catch (e) {
      return { stdout: '', stderr: `${name}: ${e.message}\n`, code: 1 };
    }
  }

  _register() {
    const fs  = () => this.#gsl.fs;
    const cwd = () => this.#session.cwd;
    const env = () => this.#session.env;

    return new Map(Object.entries({

      echo: (args) => ({
        stdout: args.join(' ') + '\n',
        stderr: '', code: 0,
      }),

      pwd: () => ({ stdout: cwd() + '\n', stderr: '', code: 0 }),

      cd: async ([path]) => {
        const err = await this.#session.cd(path);
        return err ? { stdout: '', stderr: err + '\n', code: 1 }
                   : { stdout: '', stderr: '', code: 0 };
      },

      ls: async ([...args]) => {
        const flags = args.filter(a => a.startsWith('-')).join('');
        const paths = args.filter(a => !a.startsWith('-'));
        const target = paths[0]
          ? fs().resolve(cwd(), paths[0])
          : cwd();

        try {
          const entries = await fs().readdir(target);
          const showAll = flags.includes('a');
          const longFmt = flags.includes('l');

          const filtered = showAll
            ? ['.', '..', ...entries]
            : entries.filter(e => !e.startsWith('.'));

          if (!longFmt) {
            return { stdout: filtered.join('  ') + '\n', stderr: '', code: 0 };
          }

          const lines = await Promise.all(filtered.map(async name => {
            if (name === '.' || name === '..') return `drwxr-xr-x  user  user  0  ${name}`;
            try {
              const stat = await fs().stat(`${target}/${name}`);
              const type = stat.type === 'dir' ? 'd' : stat.type === 'symlink' ? 'l' : '-';
              const size = String(stat.size).padStart(6);
              const mtime = new Date(stat.mtime).toLocaleDateString();
              return `${type}rwxr-xr-x  user  user  ${size}  ${mtime}  ${name}`;
            } catch {
              return `?---------  ?     ?     ?      ?  ${name}`;
            }
          }));

          return { stdout: lines.join('\n') + '\n', stderr: '', code: 0 };
        } catch (e) {
          return { stdout: '', stderr: `ls: ${e.message}\n`, code: 1 };
        }
      },

      cat: async ([...args]) => {
        if (args.length === 0) return { stdout: '', stderr: '', code: 0 };
        let out = '';
        for (const arg of args) {
          try {
            out += await fs().readFile(fs().resolve(cwd(), arg));
          } catch (e) {
            return { stdout: out, stderr: `cat: ${arg}: ${e.message}\n`, code: 1 };
          }
        }
        return { stdout: out, stderr: '', code: 0 };
      },

      mkdir: async ([...args]) => {
        const recursive = args.includes('-p') || args.includes('--parents');
        const paths = args.filter(a => !a.startsWith('-'));
        for (const p of paths) {
          await fs().mkdir(fs().resolve(cwd(), p), { recursive });
        }
        return { stdout: '', stderr: '', code: 0 };
      },

      rm: async ([...args]) => {
        const recursive = args.some(a => a === '-r' || a === '-rf' || a === '-R');
        const force     = args.some(a => a.includes('f'));
        const paths     = args.filter(a => !a.startsWith('-'));

        for (const p of paths) {
          const abs = fs().resolve(cwd(), p);
          try {
            const stat = await fs().stat(abs);
            if (stat.type === 'dir') {
              if (!recursive) throw new Error(`${p}: is a directory`);
              await fs().rmdir(abs, { recursive: true });
            } else {
              await fs().unlink(abs);
            }
          } catch (e) {
            if (!force) return { stdout: '', stderr: `rm: ${e.message}\n`, code: 1 };
          }
        }
        return { stdout: '', stderr: '', code: 0 };
      },

      mv: async ([src, dst]) => {
        if (!src || !dst) return { stdout: '', stderr: 'mv: missing operand\n', code: 1 };
        await fs().rename(fs().resolve(cwd(), src), fs().resolve(cwd(), dst));
        return { stdout: '', stderr: '', code: 0 };
      },

      cp: async ([src, dst]) => {
        if (!src || !dst) return { stdout: '', stderr: 'cp: missing operand\n', code: 1 };
        const content = await fs().readFile(fs().resolve(cwd(), src), { encoding: 'binary' });
        await fs().writeFile(fs().resolve(cwd(), dst), content);
        return { stdout: '', stderr: '', code: 0 };
      },

      touch: async ([...paths]) => {
        for (const p of paths) {
          const abs = fs().resolve(cwd(), p);
          if (!(await fs().exists(abs))) await fs().writeFile(abs, '');
        }
        return { stdout: '', stderr: '', code: 0 };
      },

      'export': ([...args]) => {
        for (const arg of args) {
          const [k, v] = arg.split('=');
          if (k) this.#session.env[k] = v ?? '';
        }
        return { stdout: '', stderr: '', code: 0 };
      },

      env: () => ({
        stdout: Object.entries(env()).map(([k,v]) => `${k}=${v}`).join('\n') + '\n',
        stderr: '', code: 0,
      }),

      printenv: ([name]) => ({
        stdout: name ? ((env()[name] ?? '') + '\n') : Object.values(env()).join('\n') + '\n',
        stderr: '', code: 0,
      }),

      'true':  () => ({ stdout: '', stderr: '', code: 0 }),
      'false': () => ({ stdout: '', stderr: '', code: 1 }),

      clear: () => ({ stdout: '\x1b[2J\x1b[H', stderr: '', code: 0 }),

      date: () => ({ stdout: new Date().toString() + '\n', stderr: '', code: 0 }),

      whoami: () => ({ stdout: this.#session.user + '\n', stderr: '', code: 0 }),

      hostname: () => ({ stdout: 'gecko\n', stderr: '', code: 0 }),

      uname: ([...args]) => {
        const all = args.includes('-a');
        return { stdout: all
          ? 'GeckoOS gecko 1.0.0-bijou #1 SMP ' + new Date().toDateString() + ' x86_64 GSL\n'
          : 'GeckoOS\n', stderr: '', code: 0 };
      },

      ps: () => {
        const rows = this.#gsl.ps.ps();
        const header = 'PID  USER     STAT  COMMAND\n';
        const lines  = rows.map(r =>
          `${String(r.pid).padEnd(5)}${r.user.padEnd(9)}${r.status.padEnd(6)}${r.command}`
        ).join('\n');
        return { stdout: header + lines + '\n', stderr: '', code: 0 };
      },

      kill: ([...args]) => {
        const sig  = args.find(a => a.startsWith('-'))?.slice(1) ?? '15';
        const pids = args.filter(a => !a.startsWith('-')).map(Number);
        for (const pid of pids) this.#gsl.ps.kill(pid, Number(sig));
        return { stdout: '', stderr: '', code: 0 };
      },

      grep: ([pattern, ...files], stdin) => {
        const re = new RegExp(pattern);
        if (files.length === 0) {
          const lines = stdin.split('\n').filter(l => re.test(l));
          return { stdout: lines.join('\n') + (lines.length ? '\n' : ''), stderr: '', code: lines.length ? 0 : 1 };
        }
        // TODO: multi-file grep
        return { stdout: '', stderr: 'grep: file grep not yet implemented\n', code: 1 };
      },

      head: ([...args], stdin) => {
        const n = parseInt(args.find(a => a.startsWith('-'))?.slice(1) ?? '10');
        const lines = stdin.split('\n').slice(0, n);
        return { stdout: lines.join('\n') + '\n', stderr: '', code: 0 };
      },

      tail: ([...args], stdin) => {
        const n = parseInt(args.find(a => a.startsWith('-'))?.slice(1) ?? '10');
        const lines = stdin.split('\n');
        return { stdout: lines.slice(-n).join('\n') + '\n', stderr: '', code: 0 };
      },

      wc: ([...args], stdin) => {
        const lines = stdin.split('\n').length - 1;
        const words = stdin.trim().split(/\s+/).filter(Boolean).length;
        const chars = stdin.length;
        return { stdout: `  ${lines}  ${words}  ${chars}\n`, stderr: '', code: 0 };
      },

      sort: ([], stdin) => ({
        stdout: stdin.split('\n').sort().join('\n') + '\n',
        stderr: '', code: 0,
      }),

      uniq: ([], stdin) => {
        const lines = stdin.split('\n');
        const out   = lines.filter((l, i) => i === 0 || l !== lines[i-1]);
        return { stdout: out.join('\n') + '\n', stderr: '', code: 0 };
      },

      tr: ([from, to], stdin) => {
        let out = stdin;
        for (let i = 0; i < Math.min(from?.length, to?.length); i++) {
          out = out.split(from[i]).join(to[i]);
        }
        return { stdout: out, stderr: '', code: 0 };
      },

      sleep: ([secs]) => new Promise(r => setTimeout(() => r({ stdout: '', stderr: '', code: 0 }), (parseFloat(secs) || 1) * 1000)),

      apt: async ([subcmd, ...rest]) => {
        return this.#gsl.apt.cli(subcmd, rest);
      },

      help: () => ({
        stdout: [
          'GSL (Gecko Subsystem for Linux) — available commands:',
          '',
          '  File system:  ls, cd, pwd, cat, mkdir, rm, mv, cp, touch',
          '  Text:         echo, grep, head, tail, wc, sort, uniq, tr',
          '  System:       ps, kill, date, whoami, hostname, uname, clear',
          '  Environment:  export, env, printenv',
          '  Packages:     apt install <pkg>, apt remove <pkg>, apt list',
          '  Shell:        help, true, false, sleep',
          '',
        ].join('\n'),
        stderr: '', code: 0,
      }),

    }));
  }
}
