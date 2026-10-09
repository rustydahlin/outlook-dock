# Outlook Dock

Shows the New Outlook web calendar (`https://outlook.office.com/calendar/view/day`) in a narrow frameless window docked to a screen edge as a real Windows AppBar (like the taskbar): other windows are resized to make room.

No Graph API, no app registration, no tokens. You sign in on the web page; the session persists (`persist:outlook`).

## Setup

Requires Node.js 18+ on Windows 10/11.

```powershell
cd C:\Apps\OutlookCalendarDock
npm install
```

## Run

```powershell
npm start
```

- Tray icon: left-click toggles, right-click for the menu (Show/Hide, Dock Left/Right, Width, Reload, Open in New Outlook, Start with Windows, Quit).
- Hotkey: `Ctrl+Alt+C` toggles show/hide. Hiding releases the reserved screen space.

## Build (portable .exe, no installer, no admin)

```powershell
npm run build
```

Output: `dist\Outlook Dock 0.1.0.exe`

## Config

`%APPDATA%\outlook-dock\config.json`, created on first run:

```json
{ "side": "right", "width": 380, "monitor": "primary", "zoom": 0.9, "reloadMinutes": 30, "startWithWindows": true }
```

Edit and restart to apply (`side`, `width`, `startWithWindows` can also be changed from the tray menu). `monitor` is `"primary"` or a display index (0-based).

## If screen space stays reserved after a crash

Kill the process and relaunch, or sign out/in. A normal quit, `uncaughtException`, SIGINT and SIGTERM all remove the AppBar.

## If sign-in is blocked

If Entra Conditional Access blocks Electron (non-Edge browser / device SSO required), the fallback is a .NET 8 WPF/WinForms shell with WebView2; the AppBar logic is identical via P/Invoke.
