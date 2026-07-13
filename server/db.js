// A tiny JSON-file database. No native modules required, so the project
// runs anywhere Node.js runs. Not built for heavy concurrent writes —
// perfectly fine for a single-store demo/production-starter app.
const fs = require('fs');
const path = require('path');
const { buildInitialData } = require('./seed-data');

const DB_PATH = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = buildInitialData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

let cache = load();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

module.exports = {
  get data() {
    return cache;
  },
  save,
  reload() {
    cache = load();
    return cache;
  }
};
