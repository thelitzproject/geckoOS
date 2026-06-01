/**
 * GSL Syscall Table — POSIX-like syscall interface for apps.
 * Apps use gsl.sys.call(name, ...args) instead of direct FS/net access.
 */
export class SyscallTable {
  #gsl;
  #table;

  constructor(gsl) {
    this.#gsl = gsl;
    this.#table = this._build();
  }

  async call(name, ...args) {
    const fn = this.#table[name];
    if (!fn) throw new Error(`ENOSYS: syscall '${name}' not implemented`);
    return fn(...args);
  }

  _build() {
    const fs  = () => this.#gsl.fs;
    const net = () => this.#gsl.net;
    const ps  = () => this.#gsl.ps;

    return {
      // ── Filesystem ─────────────────────────────────
      open:    (path, flags) => fs().stat(path).then(s => ({ fd: Math.random(), ...s })),
      read:    (path, opts)  => fs().readFile(path, opts),
      write:   (path, data)  => fs().writeFile(path, data),
      close:   ()            => Promise.resolve(0),
      stat:    (path)        => fs().stat(path),
      lstat:   (path)        => fs().stat(path),
      fstat:   (path)        => fs().stat(path),
      unlink:  (path)        => fs().unlink(path),
      mkdir:   (path, mode)  => fs().mkdir(path, { mode }),
      rmdir:   (path)        => fs().rmdir(path),
      rename:  (src, dst)    => fs().rename(src, dst),
      readdir: (path)        => fs().readdir(path),
      readlink:(path)        => fs().readlink(path),
      symlink: (tgt, path)   => fs().symlink(tgt, path),
      chmod:   (path, mode)  => fs().chmod(path, mode),
      truncate:(path, len)   => fs().truncate(path, len),

      // ── Network ────────────────────────────────────
      fetch:   (url, opts)   => net().fetch(url, opts),

      // ── Process ────────────────────────────────────
      getpid:  ()            => ps().list().length + 1,
      getuid:  ()            => Promise.resolve(1000),
      getgid:  ()            => Promise.resolve(1000),
      kill:    (pid, sig)    => Promise.resolve(ps().kill(pid, sig)),

      // ── Time ───────────────────────────────────────
      gettimeofday: ()       => Promise.resolve({ tv_sec: Math.floor(Date.now()/1000), tv_usec: (Date.now()%1000)*1000 }),
      clock_gettime: ()      => Promise.resolve(Date.now()),

      // ── Random ─────────────────────────────────────
      getrandom: (len)       => Promise.resolve(crypto.getRandomValues(new Uint8Array(len))),
    };
  }
}
