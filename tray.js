const { Tray, Menu, nativeImage } = require('electron');

// Generated 32x32 icon (orange square, white bar) so there are no binary assets to ship.
function makeIcon() {
  const size = 32, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    buf.set(y < 9 ? [255, 255, 255, 255] : [0xd7, 0x78, 0x00, 255], (y * size + x) * 4); // BGRA
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

// `a` = actions/state provided by main.js
function createTray(a) {
  const tray = new Tray(makeIcon());
  tray.setToolTip('Outlook Dock');
  const build = () => Menu.buildFromTemplate([
    { label: a.isVisible() ? 'Hide' : 'Show', click: a.toggle },
    { type: 'separator' },
    { label: 'Dock Left', type: 'radio', checked: a.cfg().side === 'left', click: () => a.set({ side: 'left' }) },
    { label: 'Dock Right', type: 'radio', checked: a.cfg().side === 'right', click: () => a.set({ side: 'right' }) },
    {
      label: 'Width',
      submenu: [300, 380, 450].map((w) => ({
        label: String(w), type: 'radio', checked: a.cfg().width === w, click: () => a.set({ width: w }),
      })),
    },
    { type: 'separator' },
    { label: 'Reload', click: a.reload },
    { label: 'Open in New Outlook', click: a.openInBrowser },
    {
      label: 'Start with Windows', type: 'checkbox', checked: a.cfg().startWithWindows,
      click: (item) => a.set({ startWithWindows: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: a.quit },
  ]);
  tray.on('click', a.toggle);
  tray.on('right-click', () => tray.popUpContextMenu(build()));
  return tray;
}

module.exports = { createTray };
