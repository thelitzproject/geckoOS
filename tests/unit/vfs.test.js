/**
 * Unit tests for GSL VirtualFS
 */

// Minimal IndexedDB mock for Node
import { VirtualFS } from '../../gsl/fs/vfs.js';

// We mock IndexedDB for unit testing
global.indexedDB = {
  open: () => {
    const store = new Map();
    return {
      get onsuccess()  { return null; },
      set onsuccess(fn) {
        fn({ target: { result: {
          transaction: (_, mode) => ({
            objectStore: () => ({
              get:    (key)    => { const req = {}; setTimeout(() => req.onsuccess?.({ target: { result: store.get(key) ?? null } }), 0); return req; },
              put:    (val)    => { const req = {}; store.set(val.path, val); setTimeout(() => req.onsuccess?.(), 0); return req; },
              delete: (key)    => { const req = {}; store.delete(key); setTimeout(() => req.onsuccess?.(), 0); return req; },
              index:  ()       => ({
                getAll: (range) => {
                  const parent = range.lower ?? range;
                  const req = {};
                  const results = Array.from(store.values()).filter(n => n.parent === parent);
                  setTimeout(() => req.onsuccess?.({ target: { result: results } }), 0);
                  return req;
                },
              }),
              createIndex: () => {},
            }),
          }),
          createObjectStore: () => ({ createIndex: () => {} }),
          objectStoreNames: { contains: () => true },
        }}});
      },
      get onupgradeneeded() { return null; },
      set onupgradeneeded(_) {},
      get onerror() { return null; },
      set onerror(_) {},
    };
  },
};

describe('VirtualFS', () => {
  let vfs;

  beforeEach(async () => {
    vfs = new VirtualFS(null);
    await vfs.init();
  });

  test('mkdir creates directory', async () => {
    await vfs.mkdir('/test');
    const stat = await vfs.stat('/test');
    expect(stat.type).toBe('dir');
  });

  test('writeFile and readFile roundtrip', async () => {
    await vfs.mkdir('/test');
    await vfs.writeFile('/test/hello.txt', 'hello world');
    const content = await vfs.readFile('/test/hello.txt');
    expect(content).toBe('hello world');
  });

  test('mkdir recursive creates nested dirs', async () => {
    await vfs.mkdir('/a/b/c', { recursive: true });
    expect(await vfs.exists('/a')).toBe(true);
    expect(await vfs.exists('/a/b')).toBe(true);
    expect(await vfs.exists('/a/b/c')).toBe(true);
  });

  test('unlink removes file', async () => {
    await vfs.mkdir('/tmp');
    await vfs.writeFile('/tmp/del.txt', 'data');
    await vfs.unlink('/tmp/del.txt');
    expect(await vfs.exists('/tmp/del.txt')).toBe(false);
  });

  test('readFile throws on missing file', async () => {
    await expect(vfs.readFile('/nope.txt')).rejects.toThrow('ENOENT');
  });

  test('resolve normalises paths', () => {
    expect(vfs.resolve('/home/user', '../etc/hosts')).toBe('/home/etc/hosts');
    expect(vfs.resolve('/home/user', '/abs/path')).toBe('/abs/path');
  });
});
