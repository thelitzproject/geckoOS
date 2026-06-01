/**
 * GSL Process Manager — tracks running processes, PID allocation, signals.
 */

let nextPid = 1;

export const Signal = Object.freeze({
  SIGTERM: 15,
  SIGKILL: 9,
  SIGINT:  2,
  SIGSTOP: 19,
  SIGCONT: 18,
  SIGHUP:  1,
});

export class ProcessManager {
  #gsl;
  #table = new Map(); // pid → Process

  constructor(gsl) {
    this.#gsl = gsl;
  }

  spawn(opts = {}) {
    const pid = nextPid++;
    const proc = new Process(pid, opts);
    this.#table.set(pid, proc);
    this.#gsl.events?.emit('gsl:process:spawn', { pid, name: opts.name });
    return proc;
  }

  kill(pid, signal = Signal.SIGTERM) {
    const proc = this.#table.get(pid);
    if (!proc) return false;

    proc._signal(signal);

    if (signal === Signal.SIGKILL || signal === Signal.SIGTERM) {
      this.#table.delete(pid);
      this.#gsl.events?.emit('gsl:process:exit', { pid });
    }
    return true;
  }

  get(pid) { return this.#table.get(pid) ?? null; }

  list() { return Array.from(this.#table.values()); }

  ps() {
    return this.list().map(p => ({
      pid:  p.pid,
      name: p.name,
      user: p.user,
      status: p.status,
      cpu:    '0.0',
      mem:    '0.0',
      started: p.startedAt.toLocaleTimeString(),
      command: p.command,
    }));
  }

  _reap(pid) {
    this.#table.delete(pid);
  }
}

export class Process {
  constructor(pid, opts) {
    this.pid       = pid;
    this.name      = opts.name    ?? 'unknown';
    this.command   = opts.command ?? '';
    this.user      = opts.user    ?? 'user';
    this.status    = 'running';
    this.startedAt = new Date();
    this.env       = { ...opts.env };
    this.exitCode  = null;

    this._signalHandlers = new Map();
    this._abort = new AbortController();
  }

  onSignal(sig, fn) {
    this._signalHandlers.set(sig, fn);
  }

  _signal(sig) {
    const handler = this._signalHandlers.get(sig);
    if (handler) {
      handler(sig);
    } else if (sig === Signal.SIGKILL || sig === Signal.SIGTERM) {
      this.status = 'killed';
      this.exitCode = 128 + sig;
      this._abort.abort();
    } else if (sig === Signal.SIGSTOP) {
      this.status = 'stopped';
    } else if (sig === Signal.SIGCONT) {
      this.status = 'running';
    }
  }

  get signal() { return this._abort.signal; }
}
