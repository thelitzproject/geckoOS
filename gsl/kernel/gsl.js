/**
 * GSL — Gecko Subsystem for Linux
 * A POSIX-compatible environment running entirely in the browser.
 *
 * Architecture:
 *   VirtualFS   → IndexedDB-backed virtual filesystem
 *   Shell       → bash-compatible command interpreter
 *   ProcessMgr  → process table and scheduling
 *   SyscallTable→ POSIX-like syscall interface
 *   NetworkLayer→ fetch-based network proxy
 *   PackageManager → APT-compatible package manager
 */

import { VirtualFS }      from '../fs/vfs.js';
import { Shell }          from '../shell/shell.js';
import { ProcessManager } from './process-manager.js';
import { SyscallTable }   from '../syscalls/syscalls.js';
import { NetworkLayer }   from '../net/network.js';
import { PackageManager } from '../packages/apt.js';

const GSL_VERSION = '1.10.0';

export class GSL {
  #kernel;

  constructor(kernel) {
    this.#kernel = kernel;
    this.version = GSL_VERSION;

    this.fs  = null;
    this.sh  = null;
    this.ps  = null;
    this.sys = null;
    this.net = null;
    this.apt = null;

    // Expose on window for apps and debugging
    window.gsl = this;
  }

  get events() { return this.#kernel.events; }

  async init() {
    if (!this.#kernel.settings.get('gsl.enabled')) {
      console.log('[GSL] Disabled by settings');
      return;
    }

    console.log(`[GSL] Initializing v${GSL_VERSION}...`);

    // Order matters: fs must be ready before shell/processes
    this.fs  = new VirtualFS(this);
    await this.fs.init();

    this.net = new NetworkLayer(this);
    this.sys = new SyscallTable(this);
    this.ps  = new ProcessManager(this);
    this.apt = new PackageManager(this);

    await this._provisionRootFS();

    this.sh = new Shell(this);

    this.#kernel.events.emit('gsl:ready');
    console.log('[GSL] Ready');
  }

  /**
   * Provision the initial root filesystem if it hasn't been set up yet.
   * Creates /bin, /etc, /home, /tmp, /var, /usr, /proc, etc.
   */
  async _provisionRootFS() {
    const alreadyProvisioned = await this.fs.exists('/etc/gecko-release');
    if (alreadyProvisioned) {
      // Refresh version-stamped files on every boot so upgrades are reflected
      await this.fs.writeFile('/etc/gecko-release',
        `GECKO_NAME="geckoOS"\nGECKO_VERSION="1.0.0"\nGECKO_CODENAME="Bijou"\nGECKO_BUILD="bb2"\nGSL_VERSION="${GSL_VERSION}"\n`
      );
      await this.fs.writeFile('/etc/motd',
        `Welcome to geckoOS 1.0.0 "Bijou" (Beta Build 2)\nGSL v${GSL_VERSION} — Gecko Subsystem for Linux\nType 'help' for available commands.\n`
      );
      // Ensure user home subdirs exist for users who provisioned before bb2
      const userDirs = [
        '/home/user/Desktop', '/home/user/Documents', '/home/user/Downloads',
        '/home/user/Pictures', '/home/user/Music', '/home/user/Videos',
        '/home/user/.config', '/home/user/.local', '/home/user/.local/share',
      ];
      for (const dir of userDirs) {
        if (!(await this.fs.exists(dir))) await this.fs.mkdir(dir, { recursive: true });
      }
      return;
    }

    console.log('[GSL] Provisioning root filesystem...');

    const dirs = [
      '/bin', '/sbin', '/usr', '/usr/bin', '/usr/lib', '/usr/local', '/usr/local/bin',
      '/usr/share', '/usr/share/man', '/usr/share/man/man1',
      '/etc', '/etc/apt', '/etc/apt/sources.list.d',
      '/home', '/home/user',
      '/home/user/Desktop', '/home/user/Documents', '/home/user/Downloads',
      '/home/user/Pictures', '/home/user/Music', '/home/user/Videos',
      '/home/user/.config', '/home/user/.local', '/home/user/.local/share',
      '/tmp', '/var', '/var/log', '/var/cache', '/var/cache/apt',
      '/proc', '/sys', '/dev',
      '/lib', '/lib64',
      '/opt', '/srv', '/run',
      '/root',
    ];

    for (const dir of dirs) {
      await this.fs.mkdir(dir, { recursive: true });
    }

    await this.fs.writeFile('/etc/gecko-release',
      `GECKO_NAME="geckoOS"\nGECKO_VERSION="1.0.0"\nGECKO_CODENAME="Bijou"\nGECKO_BUILD="bb2"\nGSL_VERSION="${GSL_VERSION}"\n`
    );

    await this.fs.writeFile('/etc/hostname', 'gecko\n');
    await this.fs.writeFile('/etc/hosts', '127.0.0.1\tlocalhost\n127.0.0.1\tgecko\n');

    await this.fs.writeFile('/etc/passwd',
      'root:x:0:0:root:/root:/bin/gsh\nuser:x:1000:1000:User:/home/user:/bin/gsh\n'
    );

    await this.fs.writeFile('/etc/apt/sources.list',
      '# Gecko Package Archive\ndeb https://packages.geckoos.local/apt stable main contrib\n'
    );

    await this.fs.writeFile('/home/user/.gshrc',
      '# Gecko Shell config\nexport PATH="/usr/local/bin:/usr/bin:/bin:/sbin"\nexport HOME="/home/user"\nexport USER="user"\nexport PS1="\\u@\\h:\\w$ "\n'
    );

    await this.fs.writeFile('/etc/motd',
      `Welcome to geckoOS 1.0.0 "Bijou" (Beta Build 2)\nGSL v${GSL_VERSION} — Gecko Subsystem for Linux\nType 'help' for available commands.\n`
    );

    console.log('[GSL] Root filesystem provisioned');
  }

  /**
   * Spawn a new shell session — returns a Shell instance.
   */
  async spawnShell(opts = {}) {
    if (!this.sh) throw new Error('[GSL] Shell not initialized — is gsl.enabled set to true?');
    return this.sh.createSession({
      cwd: opts.cwd ?? '/home/user',
      env: opts.env ?? {},
      user: opts.user ?? 'user',
    });
  }

  /**
   * Execute a single command and return stdout/stderr/exit code.
   */
  async exec(command, opts = {}) {
    const session = await this.spawnShell(opts);
    return session.exec(command);
  }
}
