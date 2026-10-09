const { app, BrowserWindow, screen, globalShortcut, shell } = require('electron');
const config = require('./config');
const appbar = require('./appbar');
const { createTray } = require('./tray');

const CALENDAR_URL = 'https://outlook.office.com/calendar/view/day';

// Hosts that must stay inside the window so sign-in and the calendar work.
const INTERNAL = [
  'outlook.office.com', 'outlook.office365.com', 'outlook.live.com',
  'login.microsoftonline.com', 'login.microsoft.com', 'login.live.com', 'login.windows.net',
  'msauth.net', 'msftauth.net', 'microsoftonline.com', 'office.com', 'office365.com',
  'sharepoint.com', 'microsoft.com',
];
const hostMatch = (h, list) => list.some((d) => h === d || h.endsWith('.' + d));
const isTeams = (h) => h === 'teams.microsoft.com' || h === 'teams.live.com';

let cfg, win, tray, visible = true, quitting = false, redockTimer;

// Look like plain Chrome; some Microsoft sign-in paths dislike "Electron/x" in the UA.
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/\S+/, '').replace(/ outlook-dock\/\S+/i, '').replace(/ Outlook Dock\/\S+/i, '');

if (!app.requestSingleInstanceLock()) app.quit();

// ---- AppBar cleanup on every exit path ----
const cleanup = () => appbar.remove();
process.on('exit', cleanup);
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
app.on('before-quit', () => { quitting = true; cleanup(); });
app.on('will-quit', () => { cleanup(); globalShortcut.unregisterAll(); });

// ---- Docking ----
function pickDisplay() {
  if (cfg.monitor === 'primary') return screen.getPrimaryDisplay();
  return screen.getAllDisplays()[Number(cfg.monitor)] || screen.getPrimaryDisplay();
}

function redock() {
  if (!win || !visible) return;
  appbar.dock(win, pickDisplay(), cfg.side, cfg.width, scheduleRedock);
}

function scheduleRedock() {
  clearTimeout(redockTimer);
  redockTimer = setTimeout(redock, 250);
}

function setVisible(v) {
  visible = v;
  if (v) { win.show(); redock(); } else { appbar.remove(); win.hide(); }
}

function update(patch) {
  cfg = { ...cfg, ...patch };
  config.save(cfg);
  if ('startWithWindows' in patch) applyLoginItem();
  redock();
}

function applyLoginItem() {
  if (!app.isPackaged) return; // don't register electron.exe as a startup item in dev
  app.setLoginItemSettings({
    openAtLogin: cfg.startWithWindows,
    path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath, // the portable exe, not its temp extract
  });
}

// ---- Links ----
function openExternal(url) {
  let u;
  try { u = new URL(url); } catch { return; }
  if (u.protocol === 'msteams:') return shell.openExternal(url);
  if (!['https:', 'http:', 'mailto:'].includes(u.protocol)) return;
  if (isTeams(u.hostname)) return shell.openExternal('msteams:' + u.pathname + u.search + u.hash);
  shell.openExternal(url);
}

function wireLinks(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    let host = '';
    try { host = new URL(url).hostname; } catch { /* ignore */ }
    // Sign-in popups stay in-app; everything else goes to the default browser.
    if (host.startsWith('login.') && hostMatch(host, INTERNAL)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    let u;
    try { u = new URL(url); } catch { return e.preventDefault(); }
    if (isTeams(u.hostname) || !hostMatch(u.hostname, INTERNAL)) {
      e.preventDefault();
      openExternal(url);
    }
  });
}

// ---- Window ----
function createWindow() {
  win = new BrowserWindow({
    width: cfg.width, height: 800, show: false,
    frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, backgroundColor: '#ffffff',
    webPreferences: { partition: 'persist:outlook', contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); setVisible(false); } });

  const wc = win.webContents;
  wireLinks(wc);
  wc.on('dom-ready', () => wc.setZoomFactor(cfg.zoom));
  wc.on('did-create-window', (child) => wireLinks(child.webContents)); // auth popups

  win.loadURL(CALENDAR_URL);
  setVisible(true);

  setInterval(() => { if (visible) wc.reload(); }, Math.max(1, cfg.reloadMinutes) * 60_000);
}

app.whenReady().then(() => {
  cfg = config.load();
  createWindow();
  applyLoginItem();

  tray = createTray({
    cfg: () => cfg,
    isVisible: () => visible,
    toggle: () => setVisible(!visible),
    set: update,
    reload: () => win.webContents.reload(),
    openInBrowser: () => shell.openExternal(CALENDAR_URL),
    quit: () => app.quit(),
  });

  globalShortcut.register('Control+Alt+C', () => setVisible(!visible));
  for (const ev of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(ev, scheduleRedock);
});

app.on('second-instance', () => { if (win && !visible) setVisible(true); });
app.on('window-all-closed', () => { /* keep running in the tray */ });
