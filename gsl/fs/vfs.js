/**
 * GSL Virtual Filesystem
 * IndexedDB-backed POSIX-like filesystem with in-memory cache.
 *
 * Supports: read/write/append/mkdir/rmdir/unlink/stat/readdir/symlink
 */

const DB_NAME    = 'geckoOS.gsl.fs';
const DB_VERSION = 1;
const STORE_NAME = 'nodes';

export class VirtualFS {
  #db   = null;
  #gsl;

  constructor(gsl) {
    this.#gsl = gsl;
  }

  async init() {
    this.#db = await this._openDB();
  }

  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'path' });
          store.createIndex('parent', 'parent', { unique: false });
        }
      };

      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  _tx(mode = 'readonly') {
    return this.#db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  _get(path) {
    return new Promise((res, rej) => {
      const req = this._tx().get(path);
      req.onsuccess = e => res(e.target.result ?? null);
      req.onerror   = e => rej(e.target.error);
    });
  }

  _put(node) {
    return new Promise((res, rej) => {
      const tx  = this.#db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(node);
      req.onsuccess = () => res();
      req.onerror   = e  => rej(e.target.error);
    });
  }

  _del(path) {
    return new Promise((res, rej) => {
      const tx  = this.#db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(path);
      req.onsuccess = () => res();
      req.onerror   = e  => rej(e.target.error);
    });
  }

  _byParent(parent) {
    return new Promise((res, rej) => {
      const range = IDBKeyRange.only(parent);
      const req   = this._tx().index('parent').getAll(range);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  }

  _normPath(p) {
    const parts = p.replace(/\/+/g, '/').split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '..') stack.pop();
      else if (part !== '.') stack.push(part);
    }
    return '/' + stack.join('/');
  }

  _parent(p) {
    const norm = this._normPath(p);
    if (norm === '/') return null;
    const idx = norm.lastIndexOf('/');
    return idx === 0 ? '/' : norm.slice(0, idx);
  }

  _basename(p) {
    return this._normPath(p).split('/').pop() ?? '';
  }

  _now() { return Date.now(); }

  // ── Public API ───────────────────────────────────────────────────────────

  async exists(path) {
    return (await this._get(this._normPath(path))) !== null;
  }

  async stat(path) {
    const node = await this._get(this._normPath(path));
    if (!node) throw this._noent(path);
    const { data: _data, ...meta } = node;
    return meta;
  }

  async mkdir(path, opts = {}) {
    const norm = this._normPath(path);
    if (opts.recursive) {
      const parts = norm.split('/').filter(Boolean);
      let cur = '';
      for (const p of parts) {
        cur += '/' + p;
        if (!(await this.exists(cur))) {
          await this._putDir(cur);
        }
      }
    } else {
      const parent = this._parent(norm);
      if (parent && !(await this.exists(parent))) throw this._noent(parent);
      if (await this.exists(norm)) throw Object.assign(new Error(`EEXIST: ${norm}`), { code: 'EEXIST' });
      await this._putDir(norm);
    }
  }

  async _putDir(norm) {
    await this._put({
      path:   norm,
      parent: this._parent(norm) ?? '',
      type:   'dir',
      mode:   0o755,
      uid:    1000,
      gid:    1000,
      size:   0,
      atime:  this._now(),
      mtime:  this._now(),
      ctime:  this._now(),
    });
  }

  async writeFile(path, content, opts = {}) {
    const norm = this._normPath(path);
    const parent = this._parent(norm);
    if (parent && !(await this.exists(parent))) {
      if (opts.recursive) await this.mkdir(parent, { recursive: true });
      else throw this._noent(parent);
    }

    const existing = await this._get(norm);
    const encoder  = new TextEncoder();
    let data;

    if (opts.append && existing?.data) {
      const old = typeof existing.data === 'string'
        ? new TextEncoder().encode(existing.data)
        : existing.data;
      const add = typeof content === 'string' ? encoder.encode(content) : content;
      data = new Uint8Array(old.length + add.length);
      data.set(old); data.set(add, old.length);
    } else {
      data = typeof content === 'string' ? encoder.encode(content) : content;
    }

    await this._put({
      path:   norm,
      parent: parent ?? '',
      type:   'file',
      mode:   opts.mode ?? 0o644,
      uid:    1000,
      gid:    1000,
      size:   data.length,
      atime:  this._now(),
      mtime:  this._now(),
      ctime:  existing?.ctime ?? this._now(),
      data,
    });
  }

  async readFile(path, opts = {}) {
    const node = await this._get(this._normPath(path));
    if (!node) throw this._noent(path);
    if (node.type !== 'file') throw Object.assign(new Error(`EISDIR: ${path}`), { code: 'EISDIR' });

    const raw = node.data instanceof Uint8Array
      ? node.data
      : new TextEncoder().encode(node.data ?? '');

    if (opts.encoding === 'binary') return raw;
    return new TextDecoder().decode(raw);
  }

  async appendFile(path, content) {
    return this.writeFile(path, content, { append: true });
  }

  async unlink(path) {
    const norm = this._normPath(path);
    const node = await this._get(norm);
    if (!node) throw this._noent(path);
    if (node.type === 'dir') throw Object.assign(new Error(`EISDIR: ${path}`), { code: 'EISDIR' });
    await this._del(norm);
  }

  async rmdir(path, opts = {}) {
    const norm = this._normPath(path);
    if (opts.recursive) {
      await this._rmRecursive(norm);
    } else {
      const children = await this._byParent(norm);
      if (children.length > 0) throw Object.assign(new Error(`ENOTEMPTY: ${path}`), { code: 'ENOTEMPTY' });
      await this._del(norm);
    }
  }

  async _rmRecursive(norm) {
    const children = await this._byParent(norm);
    for (const child of children) {
      if (child.type === 'dir') await this._rmRecursive(child.path);
      else await this._del(child.path);
    }
    await this._del(norm);
  }

  async readdir(path) {
    const norm = this._normPath(path);
    const node = await this._get(norm);
    if (!node) throw this._noent(path);
    if (node.type !== 'dir') throw Object.assign(new Error(`ENOTDIR: ${path}`), { code: 'ENOTDIR' });

    const children = await this._byParent(norm);
    return children.map(c => this._basename(c.path));
  }

  async rename(oldPath, newPath) {
    const oldNorm = this._normPath(oldPath);
    const newNorm = this._normPath(newPath);
    const node = await this._get(oldNorm);
    if (!node) throw this._noent(oldPath);

    await this._put({ ...node, path: newNorm, parent: this._parent(newNorm) ?? '' });
    await this._del(oldNorm);
  }

  async symlink(target, linkPath) {
    const norm = this._normPath(linkPath);
    await this._put({
      path:   norm,
      parent: this._parent(norm) ?? '',
      type:   'symlink',
      target,
      mode:   0o777,
      uid:    1000,
      gid:    1000,
      size:   target.length,
      atime:  this._now(),
      mtime:  this._now(),
      ctime:  this._now(),
    });
  }

  async readlink(path) {
    const node = await this._get(this._normPath(path));
    if (!node) throw this._noent(path);
    if (node.type !== 'symlink') throw new Error(`EINVAL: ${path} is not a symlink`);
    return node.target;
  }

  async chmod(path, mode) {
    const node = await this._get(this._normPath(path));
    if (!node) throw this._noent(path);
    await this._put({ ...node, mode, ctime: this._now() });
  }

  async truncate(path, len = 0) {
    const node = await this._get(this._normPath(path));
    if (!node) throw this._noent(path);
    const data = (node.data ?? new Uint8Array()).slice(0, len);
    await this._put({ ...node, data, size: data.length, mtime: this._now() });
  }

  _noent(path) {
    return Object.assign(new Error(`ENOENT: no such file or directory '${path}'`), { code: 'ENOENT' });
  }

  // Convenience: resolve path against cwd
  resolve(cwd, path) {
    if (path.startsWith('/')) return this._normPath(path);
    return this._normPath(cwd + '/' + path);
  }
}
