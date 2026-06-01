/**
 * Desktop surface manager — wallpaper, icons, right-click menu.
 */
export class Desktop {
  #kernel;
  #surface;

  constructor(kernel) {
    this.#kernel = kernel;
    this.#surface = document.getElementById('desktop-surface');
    this._init();
  }

  _init() {
    this.#surface.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.#kernel.contextMenu.show(e.clientX, e.clientY, this._desktopMenu());
    });

    this.#surface.addEventListener('click', () => {
      this.#kernel.contextMenu.hide();
      this.#kernel.menubar.setActiveApp(null);
    });
  }

  _desktopMenu() {
    return [
      { label: 'New Folder',      action: () => this._newFolder() },
      { label: 'Get Info',        action: () => {} },
      { separator: true },
      { label: 'Change Wallpaper', action: () => this.#kernel.openApp('settings') },
      { separator: true },
      { label: 'Open Terminal',   action: () => this.#kernel.openApp('terminal') },
    ];
  }

  _newFolder() {
    // TODO: create folder icon on desktop surface
    this.#kernel.notify('Desktop', 'New Folder created');
  }

  setWallpaper(url) {
    this.#surface.style.backgroundImage = `url(${url})`;
    this.#kernel.settings.set('desktop.wallpaper', url);
  }
}
