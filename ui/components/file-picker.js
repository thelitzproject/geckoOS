

export class FilePicker {
  #kernel;

  constructor(kernel) {
    this.#kernel = kernel;
  }

  open({ mode = 'open', startDir = '/home/user', filename = '' } = {}) {
    return new Promise(resolve => {
      this._build(mode, startDir, filename, resolve);
    });
  }

  _build(mode, startDir, filename, resolve) {
    let cwd = startDir;

    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

    // Panel
    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:var(--color-window-bg)',
      'border:0.5px solid var(--color-border)',
      'border-radius:14px',
      'box-shadow:0 24px 64px rgba(0,0,0,0.6)',
      'width:520px',
      'height:420px',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
      'font-size:13px',
      'color:var(--color-text-primary)',
    ].join(';');

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = 'padding:14px 18px 10px;border-bottom:0.5px solid var(--color-separator);flex-shrink:0;display:flex;align-items:center;gap:8px;';
    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'font-size:14px;font-weight:600;flex:1;';
    titleEl.textContent = mode === 'save' ? 'Save' : 'Open';
    const backBtn = document.createElement('button');
    backBtn.textContent = '←';
    backBtn.style.cssText = 'background:none;border:none;font-size:16px;cursor:pointer;color:var(--color-text-secondary);padding:0 4px;';
    titleBar.append(backBtn, titleEl);

    // Path bar
    const pathBar = document.createElement('div');
    pathBar.style.cssText = 'padding:4px 18px;background:var(--color-surface-2);font-size:11px;color:var(--color-text-secondary);border-bottom:0.5px solid var(--color-separator);flex-shrink:0;';

    // File list
    const list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto;padding:8px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:4px;';

    // Filename row (save mode)
    let filenameInput = null;
    const filenameRow = document.createElement('div');
    filenameRow.style.cssText = `display:${mode === 'save' ? 'flex' : 'none'};align-items:center;gap:8px;padding:8px 18px;border-top:0.5px solid var(--color-separator);flex-shrink:0;`;
    const fnLabel = document.createElement('label');
    fnLabel.textContent = 'Save As:';
    fnLabel.style.cssText = 'font-size:12px;color:var(--color-text-secondary);white-space:nowrap;';
    filenameInput = document.createElement('input');
    filenameInput.value = filename;
    filenameInput.style.cssText = 'flex:1;padding:5px 10px;border:0.5px solid var(--color-border);border-radius:6px;background:var(--color-surface-2);font-size:13px;color:var(--color-text-primary);outline:none;';
    filenameRow.append(fnLabel, filenameInput);

    // Action bar
    const actionBar = document.createElement('div');
    actionBar.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 18px;border-top:0.5px solid var(--color-separator);flex-shrink:0;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:5px 16px;background:var(--color-surface-2);border:0.5px solid var(--color-border);border-radius:8px;cursor:pointer;color:var(--color-text-primary);font-size:13px;';
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = mode === 'save' ? 'Save' : 'Open';
    confirmBtn.style.cssText = 'padding:5px 16px;background:var(--color-accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;';
    actionBar.append(cancelBtn, confirmBtn);

    panel.append(titleBar, pathBar, list, filenameRow, actionBar);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let selectedPath = null;

    const navigate = async (dir) => {
      cwd = this.#kernel.gsl.fs.resolve(cwd, dir);
      selectedPath = null;
      pathBar.textContent = cwd;
      list.innerHTML = '';

      let entries = [];
      try { entries = await this.#kernel.gsl.fs.readdir(cwd); }
      catch (e) { return; }

      // Parent directory entry
      if (cwd !== '/') {
        const up = this._makeEntry('..', '📁', true);
        up.addEventListener('dblclick', () => navigate('..'));
        list.appendChild(up);
      }

      for (const name of entries.sort()) {
        const fullPath = `${cwd}/${name}`;
        let isDir = false;
        try {
          const stat = await this.#kernel.gsl.fs.stat(fullPath);
          isDir = stat.type === 'dir';
        } catch {}

        const emoji = isDir ? '📁' : this._fileEmoji(name);
        const entry = this._makeEntry(name, emoji, isDir);

        entry.addEventListener('click', () => {
          list.querySelectorAll('.fp-entry').forEach(e => e.style.background = '');
          entry.style.background = 'rgba(0,122,255,0.18)';
          if (!isDir) {
            selectedPath = fullPath;
            if (filenameInput) filenameInput.value = name;
          }
        });

        entry.addEventListener('dblclick', () => {
          if (isDir) {
            navigate(fullPath);
          } else {
            selectedPath = fullPath;
            confirm();
          }
        });

        list.appendChild(entry);
      }
    };

    const confirm = () => {
      let result = null;
      if (mode === 'save') {
        const fname = filenameInput?.value.trim();
        if (fname) result = `${cwd}/${fname}`;
      } else {
        result = selectedPath;
      }
      cleanup();
      resolve(result);
    };

    const cleanup = () => overlay.remove();

    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', () => { cleanup(); resolve(null); });
    backBtn.addEventListener('click', () => { if (cwd !== '/') navigate('..'); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); resolve(null); } });
    if (filenameInput) {
      filenameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
    }

    navigate(cwd);
  }

  _makeEntry(name, emoji, isDir) {
    const el = document.createElement('div');
    el.className = 'fp-entry';
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:6px;cursor:pointer;width:100%;box-sizing:border-box;';
    el.innerHTML = `<span style="font-size:16px;flex-shrink:0;">${emoji}</span><span style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-primary);">${name}</span>`;
    el.addEventListener('mouseenter', () => { if (!el.style.background.includes('122')) el.style.background = 'var(--color-surface-2)'; });
    el.addEventListener('mouseleave', () => { if (!el.style.background.includes('122')) el.style.background = ''; });
    return el;
  }

  _fileEmoji(name) {
    const ext = name.split('.').pop().toLowerCase();
    return { js:'📄', ts:'📄', json:'📋', txt:'📝', md:'📝', sh:'📄', html:'🌐', css:'🎨', png:'🖼', jpg:'🖼', svg:'🖼' }[ext] ?? '📄';
  }
}
