/**
 * GSL Package Manager — APT-compatible package management for geckoOS.
 * Packages are JS modules + metadata fetched from the Gecko Package Archive.
 */

const CACHE_KEY = 'geckoOS.apt.cache';
const INSTALLED_KEY = 'geckoOS.apt.installed';

export class PackageManager {
  #gsl;
  #installed = new Map(); // name → PackageRecord
  #cache     = null;      // available packages list

  constructor(gsl) {
    this.#gsl = gsl;
    this._loadInstalled();
  }

  _loadInstalled() {
    try {
      const raw = localStorage.getItem(INSTALLED_KEY);
      if (raw) {
        for (const pkg of JSON.parse(raw)) {
          this.#installed.set(pkg.name, pkg);
        }
      }
    } catch {}
  }

  _saveInstalled() {
    localStorage.setItem(INSTALLED_KEY, JSON.stringify(Array.from(this.#installed.values())));
  }

  /** Main CLI dispatcher — called by the 'apt' builtin */
  async cli(subcmd, args) {
    switch (subcmd) {
      case 'install':   return this._install(args);
      case 'remove':
      case 'purge':     return this._remove(args);
      case 'update':    return this._update();
      case 'upgrade':   return this._upgrade();
      case 'list':      return this._list(args);
      case 'show':      return this._show(args[0]);
      case 'search':    return this._search(args[0]);
      case 'autoremove':return { stdout: '0 packages removed.\n', stderr: '', code: 0 };
      default:
        return {
          stdout: '',
          stderr: `apt: unknown command '${subcmd}'\nUsage: apt [install|remove|update|upgrade|list|show|search]\n`,
          code: 1,
        };
    }
  }

  async _install(names) {
    if (!names.length) return { stdout: '', stderr: 'apt install: package name required\n', code: 1 };
    let out = '';

    for (const name of names) {
      if (this.#installed.has(name)) {
        out += `${name} is already the newest version.\n`;
        continue;
      }

      out += `Reading package lists... Done\nBuilding dependency tree... Done\n`;
      out += `The following packages will be installed:\n  ${name}\n`;
      out += `Fetching: ${name}...`;

      try {
        const pkg = await this._fetchPackageMeta(name);
        await this._installPackage(pkg);
        out += ` done\n${name} (${pkg.version}) installed.\n`;
      } catch (e) {
        return { stdout: out, stderr: `\napt: unable to install ${name}: ${e.message}\n`, code: 1 };
      }
    }

    return { stdout: out, stderr: '', code: 0 };
  }

  async _remove(names) {
    let out = '';
    for (const name of names) {
      if (!this.#installed.has(name)) {
        out += `${name}: not installed\n`;
        continue;
      }
      const pkg = this.#installed.get(name);
      // Remove binaries from VFS
      if (pkg.bins) {
        for (const bin of pkg.bins) {
          await this.#gsl.fs.unlink(`/usr/bin/${bin}`).catch(() => {});
        }
      }
      this.#installed.delete(name);
      this._saveInstalled();
      out += `Removed ${name}.\n`;
    }
    return { stdout: out, stderr: '', code: 0 };
  }

  async _update() {
    let out = 'Get:1 https://packages.geckoos.local/apt stable InRelease\n';
    out += 'Reading package lists... Done\n';
    this.#cache = null; // invalidate cache
    try {
      await this._fetchPackageList();
      out += `${this.#cache?.length ?? 0} packages can be upgraded.\n`;
    } catch {
      out += 'Failed to fetch package list. Working offline.\n';
    }
    return { stdout: out, stderr: '', code: 0 };
  }

  async _upgrade() {
    return { stdout: '0 upgraded, 0 newly installed, 0 to remove.\n', stderr: '', code: 0 };
  }

  _list(args) {
    const installed = args.includes('--installed');
    const pkgs = installed
      ? Array.from(this.#installed.values())
      : (this.#cache ?? Array.from(this.#installed.values()));

    const lines = pkgs.map(p =>
      `${p.name}/${p.channel ?? 'stable'} ${p.version} all${this.#installed.has(p.name) ? ' [installed]' : ''}`
    );
    return { stdout: 'Listing...\n' + lines.join('\n') + '\n', stderr: '', code: 0 };
  }

  async _show(name) {
    if (!name) return { stdout: '', stderr: 'apt show: package name required\n', code: 1 };
    const pkg = this.#installed.get(name) ?? await this._fetchPackageMeta(name).catch(() => null);
    if (!pkg) return { stdout: '', stderr: `apt show: no package named ${name}\n`, code: 1 };
    const out = [
      `Package: ${pkg.name}`,
      `Version: ${pkg.version}`,
      `Description: ${pkg.description ?? 'No description.'}`,
      `Maintainer: ${pkg.maintainer ?? 'GeckoOS Project'}`,
      `Installed: ${this.#installed.has(name) ? 'yes' : 'no'}`,
    ].join('\n') + '\n';
    return { stdout: out, stderr: '', code: 0 };
  }

  async _search(query) {
    if (!query) return { stdout: '', stderr: 'apt search: query required\n', code: 1 };
    const pkgs = (this.#cache ?? BUNDLED_PACKAGES).filter(p =>
      p.name.includes(query) || p.description?.includes(query)
    );
    const out = pkgs.map(p => `${p.name} - ${p.description ?? ''}`).join('\n');
    return { stdout: out || 'No packages found.\n', stderr: '', code: 0 };
  }

  async _fetchPackageMeta(name) {
    // Check bundled package registry first
    const bundled = BUNDLED_PACKAGES.find(p => p.name === name);
    if (bundled) return bundled;
    throw new Error(`package '${name}' not found`);
  }

  async _fetchPackageList() {
    this.#cache = BUNDLED_PACKAGES;
  }

  async _installPackage(pkg) {
    // Write binary stubs to VFS
    if (pkg.bins) {
      for (const [binName, content] of Object.entries(pkg.bins)) {
        await this.#gsl.fs.writeFile(`/usr/bin/${binName}`, content ?? `#!/bin/gsh\necho "${binName}: not implemented"\n`);
      }
    }
    // Write man pages
    if (pkg.man) {
      for (const [page, content] of Object.entries(pkg.man)) {
        await this.#gsl.fs.writeFile(`/usr/share/man/man1/${page}.1`, content, { recursive: true });
      }
    }

    this.#installed.set(pkg.name, pkg);
    this._saveInstalled();
  }
}

// Bundled package registry — ships with geckoOS
const BUNDLED_PACKAGES = [
  {
    name: 'coreutils', version: '9.1.0', channel: 'main',
    description: 'Basic file, shell and text manipulation utilities',
    maintainer: 'GeckoOS Project',
    bins: {},
  },
  {
    name: 'nano', version: '7.2.0', channel: 'main',
    description: 'Small, friendly text editor',
    bins: { nano: '#!/bin/gsh\necho "nano: use TextPad app for editing"\n' },
  },
  {
    name: 'curl', version: '8.5.0', channel: 'main',
    description: 'Tool for transferring data with URL syntax',
    bins: { curl: '#!/bin/gsh\ncurl "$@"\n' },
  },
  {
    name: 'wget', version: '1.21.4', channel: 'main',
    description: 'Non-interactive network downloader',
    bins: { wget: '#!/bin/gsh\nwget "$@"\n' },
  },
  {
    name: 'python3', version: '3.12.0', channel: 'main',
    description: 'Python 3 (Pyodide WASM runtime)',
    bins: { python3: '#!/bin/gsh\necho "python3: install pyodide via the App Store"\n' },
  },
  {
    name: 'git', version: '2.44.0', channel: 'main',
    description: 'Distributed version control system',
    bins: { git: '#!/bin/gsh\necho "git: GSL git not yet implemented"\n' },
  },
  {
    name: 'node', version: '22.0.0', channel: 'main',
    description: 'JavaScript runtime (QuickJS WASM)',
    bins: { node: '#!/bin/gsh\necho "node: install via App Store"\n' },
  },
  {
    name: 'vim', version: '9.1.0', channel: 'main',
    description: 'Vi IMproved text editor',
    bins: { vim: '#!/bin/gsh\necho "vim: use TextPad app or install vim-wasm"\n' },
  },
];
