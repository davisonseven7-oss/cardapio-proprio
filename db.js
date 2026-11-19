/* Banco de dados (SQLite embutido no Node, sem instalar nada).
   No Railway, aponte DATA_DIR para o volume (ex.: /data) para os dados não sumirem a cada deploy. */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'cardapio.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants(
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',          -- ativo | pausado
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL,                             -- admin | cliente
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acting_tenant INTEGER,                          -- admin "entrou como" um cliente
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS brands(               -- lojas/marcas dentro do mesmo cliente (ex.: Potengi + Don Diego)
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sub TEXT DEFAULT '', logo TEXT DEFAULT '', sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL, icon TEXT DEFAULT '', sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL, descr TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  promo_price REAL, promo_days TEXT DEFAULT '[]', promo_label TEXT DEFAULT '',  -- promo do dia: dias 0-6 ([] = todo dia)
  bulk_qty INTEGER, bulk_price REAL,                                         -- atacado
  img TEXT DEFAULT '', icon TEXT DEFAULT '', tag TEXT DEFAULT '',
  options TEXT DEFAULT '[]',                                                 -- [{nome, itens:[[nome, extra]]}]
  keywords TEXT DEFAULT '',                                                  -- palavras extras p/ o robô
  active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stories(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, cover TEXT DEFAULT '', slides TEXT DEFAULT '[]', sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  img TEXT DEFAULT '', product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  caption TEXT DEFAULT '', overlay TEXT DEFAULT '', active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS likes(
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  visitor TEXT NOT NULL, week TEXT NOT NULL,
  PRIMARY KEY(tenant_id, product_id, visitor, week)
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  num INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'novo',           -- novo | preparando | saiu | concluido | cancelado
  customer TEXT, phone TEXT, address TEXT, bairro TEXT, payment TEXT, notes TEXT,
  items TEXT NOT NULL, subtotal REAL, discount REAL, fee REAL, total REAL,
  visitor TEXT, source TEXT
);
CREATE INDEX IF NOT EXISTS orders_t ON orders(tenant_id, created_at);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, info TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS events_t ON events(tenant_id, created_at);
`);

const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
module.exports = { db, DATA_DIR, J };
