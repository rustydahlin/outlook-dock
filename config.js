const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  side: 'right',          // "right" | "left"
  width: 380,             // DIPs
  monitor: 'primary',     // "primary" | display index
  zoom: 0.9,
  reloadMinutes: 30,
  startWithWindows: true,
};

const file = () => path.join(app.getPath('userData'), 'config.json');

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { /* first run or bad file */ }
  const cfg = { ...DEFAULTS, ...saved };
  if (!fs.existsSync(file())) save(cfg);
  return cfg;
}

function save(cfg) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cfg, null, 2));
}

module.exports = { load, save, file };
