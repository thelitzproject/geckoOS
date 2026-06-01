/**
 * GSL Network Layer — fetch-based HTTP/WebSocket proxy.
 * Provides wget, curl, and a raw fetch API to shell scripts.
 */
export class NetworkLayer {
  #gsl;

  constructor(gsl) {
    this.#gsl = gsl;
  }

  /**
   * HTTP fetch — returns { status, headers, body: string }
   */
  async fetch(url, opts = {}) {
    try {
      const resp = await globalThis.fetch(url, {
        method:  opts.method  ?? 'GET',
        headers: opts.headers ?? {},
        body:    opts.body,
        signal:  opts.signal,
      });

      const body = await resp.text();
      const headers = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });

      return { status: resp.status, ok: resp.ok, headers, body, url: resp.url };
    } catch (e) {
      throw new Error(`Network error: ${e.message}`);
    }
  }

  /** curl-compatible CLI implementation */
  async curl(args) {
    const flags = {};
    let url = null;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-s' || a === '--silent') flags.silent = true;
      else if (a === '-I' || a === '--head') flags.head = true;
      else if (a === '-L' || a === '--location') flags.follow = true;
      else if ((a === '-o' || a === '--output') && args[i+1]) { flags.output = args[++i]; }
      else if ((a === '-X' || a === '--request') && args[i+1]) { flags.method = args[++i]; }
      else if ((a === '-H' || a === '--header') && args[i+1]) {
        flags.headers = flags.headers ?? {};
        const [k, v] = args[++i].split(':');
        flags.headers[k.trim()] = v?.trim();
      } else if (!a.startsWith('-')) url = a;
    }

    if (!url) return { stdout: '', stderr: 'curl: no URL specified\n', code: 1 };

    try {
      const r = await this.fetch(url, { method: flags.method, headers: flags.headers });
      if (flags.head) {
        const hdr = `HTTP/1.1 ${r.status}\n` +
          Object.entries(r.headers).map(([k,v]) => `${k}: ${v}`).join('\n') + '\n';
        return { stdout: hdr, stderr: '', code: 0 };
      }
      if (flags.output) {
        await this.#gsl.fs.writeFile(
          this.#gsl.fs.resolve(this.#gsl.sh?.cwd ?? '/tmp', flags.output),
          r.body
        );
        return { stdout: '', stderr: flags.silent ? '' : `  % Total transferred: ${r.body.length} bytes\n`, code: 0 };
      }
      return { stdout: r.body, stderr: '', code: r.ok ? 0 : 1 };
    } catch (e) {
      return { stdout: '', stderr: `curl: ${e.message}\n`, code: 1 };
    }
  }

  /** wget-compatible implementation */
  async wget(args) {
    const quiet = args.includes('-q') || args.includes('--quiet');
    const url   = args.find(a => !a.startsWith('-'));

    if (!url) return { stdout: '', stderr: 'wget: missing URL\n', code: 1 };

    const filename = url.split('/').pop().split('?')[0] || 'index.html';

    try {
      const r = await this.fetch(url);
      await this.#gsl.fs.writeFile(`/home/user/${filename}`, r.body, { recursive: true });
      return {
        stdout: quiet ? '' : `Saving to: '${filename}'\n${filename} saved [${r.body.length}]\n`,
        stderr: '', code: 0,
      };
    } catch (e) {
      return { stdout: '', stderr: `wget: ${e.message}\n`, code: 1 };
    }
  }
}
