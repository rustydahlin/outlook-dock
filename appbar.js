// Windows AppBar registration via shell32!SHAppBarMessage (koffi FFI).
const { screen } = require('electron');
const koffi = require('koffi');

const ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3;
const ABN_POSCHANGED = 1;
const ABE_LEFT = 0, ABE_RIGHT = 2;
const WM_APPBAR = 0x0401; // WM_USER + 1, our callback message

const RECT = koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
const APPBARDATA = koffi.struct('APPBARDATA', {
  cbSize: 'uint32',
  hWnd: 'intptr_t',
  uCallbackMessage: 'uint32',
  uEdge: 'uint32',
  rc: RECT,
  lParam: 'intptr_t',
});
const shell32 = koffi.load('shell32.dll');
const SHAppBarMessage = shell32.func('uintptr_t SHAppBarMessage(uint32_t dwMessage, _Inout_ APPBARDATA *pData)');

let registered = null; // BrowserWindow currently registered
let hwnd = 0n;

function send(msg, extra = {}) {
  const data = {
    cbSize: koffi.sizeof(APPBARDATA), hWnd: hwnd, uCallbackMessage: WM_APPBAR,
    uEdge: ABE_RIGHT, rc: { left: 0, top: 0, right: 0, bottom: 0 }, lParam: 0, ...extra,
  };
  SHAppBarMessage(msg, data);
  return data;
}

function register(win, onPosChanged) {
  if (registered) return;
  hwnd = win.getNativeWindowHandle().readBigUInt64LE(0);
  send(ABM_NEW);
  win.hookWindowMessage(WM_APPBAR, (wParam) => {
    if (wParam.readUInt32LE(0) === ABN_POSCHANGED) onPosChanged();
  });
  registered = win;
}

// Reserve `widthDip` of screen on `side` of `display`, then move the window into it.
function dock(win, display, side, widthDip, onPosChanged) {
  register(win, onPosChanged);
  const edge = side === 'left' ? ABE_LEFT : ABE_RIGHT;

  // Park on the target display first so DIP<->physical conversion uses its scale factor.
  const b = display.bounds;
  win.setBounds({ x: b.x, y: b.y, width: widthDip, height: b.height });
  const full = screen.dipToScreenRect(win, b);
  const w = Math.round(widthDip * display.scaleFactor);

  let rc = { left: full.x, top: full.y, right: full.x + full.width, bottom: full.y + full.height };
  rc = send(ABM_QUERYPOS, { uEdge: edge, rc }).rc;
  if (edge === ABE_LEFT) rc.right = rc.left + w; else rc.left = rc.right - w;
  rc = send(ABM_SETPOS, { uEdge: edge, rc }).rc;

  const dip = screen.screenToDipRect(win, {
    x: rc.left, y: rc.top, width: rc.right - rc.left, height: rc.bottom - rc.top,
  });
  win.setBounds(dip);
  win.setBounds(dip); // second pass: first one can be mis-scaled when crossing DPI boundaries
}

// Idempotent. Must run on every exit path or Windows keeps the space reserved.
function remove() {
  if (!registered) return;
  const win = registered;
  registered = null;
  try { send(ABM_REMOVE); } catch { /* shutting down */ }
  try { if (!win.isDestroyed()) win.unhookWindowMessage(WM_APPBAR); } catch { /* ignore */ }
}

module.exports = { dock, remove };
