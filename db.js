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

/* migrações simples: colunas novas em bancos que já existem */
const addCol = (tb, col, def) => { const cols = db.prepare(`PRAGMA table_info(${tb})`).all().map(c => c.name); if (!cols.includes(col)) db.exec(`ALTER TABLE ${tb} ADD COLUMN ${col} ${def}`); };
addCol('orders', 'track', 'TEXT');                 // código secreto da página de acompanhamento
addCol('orders', 'log', "TEXT DEFAULT '[]'");      // histórico de status [{s, t}]
for (const o of db.prepare('SELECT id, created_at FROM orders WHERE track IS NULL').all())
  db.prepare('UPDATE orders SET track=?, log=? WHERE id=?').run(require('crypto').randomBytes(8).toString('base64url'), JSON.stringify([{ s: 'novo', t: o.created_at }]), o.id);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_track ON orders(track)');

/* cadastro de clientes (um por WhatsApp em cada loja) */
db.exec(`CREATE TABLE IF NOT EXISTS customers(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, name TEXT DEFAULT '', email TEXT DEFAULT '', birthday TEXT DEFAULT '',
  address TEXT DEFAULT '', bairro TEXT DEFAULT '', notes TEXT DEFAULT '', tags TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, phone)
)`);
/* quem já pediu antes do cadastro existir vira cliente cadastrado */
db.exec(`INSERT OR IGNORE INTO customers(tenant_id, phone, name, address, bairro, created_at)
  SELECT o.tenant_id, o.phone, o.customer, o.address, o.bairro, MIN(o.created_at) FROM orders o WHERE o.phone!='' GROUP BY o.tenant_id, o.phone`);

/* ---- Fase 1: cupons, fidelidade, entrega por distância ---- */
db.exec(`
CREATE TABLE IF NOT EXISTS coupons(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'percent',   -- percent | valor | frete
  valor REAL DEFAULT 0, minimo REAL DEFAULT 0, inicio TEXT DEFAULT '', fim TEXT DEFAULT '',
  max_usos INTEGER DEFAULT 0, por_cliente INTEGER DEFAULT 1, primeira INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1,
  descricao TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, code)
);
CREATE TABLE IF NOT EXISTS cashback(                          -- extrato de cashback e selos por cliente
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, valor REAL NOT NULL DEFAULT 0, tipo TEXT NOT NULL, -- ganho | uso | estorno | selo
  order_id INTEGER, expira TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS cashback_p ON cashback(tenant_id, phone);
CREATE TABLE IF NOT EXISTS geocache(q TEXT PRIMARY KEY, lat REAL, lng REAL, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
`);
addCol('orders', 'coupon', "TEXT DEFAULT ''");
addCol('orders', 'descontos', "TEXT DEFAULT '[]'");   // [{tipo, label, valor}]
addCol('orders', 'cashback_usado', 'REAL DEFAULT 0');
addCol('orders', 'km', 'REAL');
addCol('orders', 'cep', "TEXT DEFAULT ''");

/* ---- Fase 2: entregadores ---- */
db.exec(`CREATE TABLE IF NOT EXISTS couriers(
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, phone TEXT DEFAULT '', veiculo TEXT DEFAULT 'Moto',
  pagamento TEXT DEFAULT 'taxa',          -- taxa (recebe a taxa de entrega) | fixo (valor por entrega)
  valor REAL DEFAULT 0, ativo INTEGER DEFAULT 1, token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
addCol('orders', 'courier_id', 'INTEGER');
addCol('orders', 'courier_valor', 'REAL DEFAULT 0');
addCol('orders', 'courier_pago', 'TEXT');         // data do acerto

/* ---- Fase 3: estoque, caixa, balcão, mesas e garçons ---- */
addCol('products', 'estoque_controle', 'INTEGER DEFAULT 0');
addCol('products', 'estoque', 'REAL DEFAULT 0');
addCol('products', 'estoque_min', 'REAL DEFAULT 0');
addCol('orders', 'canal', "TEXT DEFAULT 'delivery'");   // delivery | balcao | mesa
addCol('orders', 'mesa_id', 'INTEGER');
addCol('orders', 'garcom', "TEXT DEFAULT ''");
addCol('orders', 'caixa_id', 'INTEGER');
addCol('orders', 'servico', 'REAL DEFAULT 0');           // taxa de serviço (mesa)
db.exec(`
CREATE TABLE IF NOT EXISTS stock_moves(
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL, qtd REAL NOT NULL, motivo TEXT NOT NULL,  -- venda | cancelamento | entrada | ajuste | perda
  order_id INTEGER, obs TEXT DEFAULT '', por TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS stock_moves_p ON stock_moves(tenant_id, product_id);
CREATE TABLE IF NOT EXISTS caixas(
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aberto_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), aberto_por TEXT DEFAULT '', valor_inicial REAL DEFAULT 0,
  fechado_em TEXT, fechado_por TEXT DEFAULT '', valor_contado REAL, resumo TEXT DEFAULT '{}', obs TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS caixa_movs(
  id INTEGER PRIMARY KEY, caixa_id INTEGER NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, valor REAL NOT NULL, motivo TEXT DEFAULT '', por TEXT DEFAULT '',   -- sangria | reforco
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS mesas(
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, sort INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS garcons(
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, token TEXT UNIQUE NOT NULL, ativo INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

/* ---- backup: uma cópia por dia (guarda 14) ---- */
const BK = path.join(DATA_DIR, 'backups'); fs.mkdirSync(BK, { recursive: true });
function backupNow(file) { const f = file || path.join(BK, `cardapio-${new Date().toISOString().slice(0, 10)}.db`); try { fs.unlinkSync(f); } catch {} db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`); return f; }
function dailyBackup() {
  try { const f = path.join(BK, `cardapio-${new Date().toISOString().slice(0, 10)}.db`); if (!fs.existsSync(f)) backupNow(f);
    fs.readdirSync(BK).filter(n => /^cardapio-\d{4}-\d{2}-\d{2}\.db$/.test(n)).sort().slice(0, -14).forEach(n => fs.unlinkSync(path.join(BK, n))); }
  catch (e) { console.error('backup', e.message); }
}
dailyBackup(); setInterval(dailyBackup, 3 * 36e5).unref();

const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
module.exports = { db, DATA_DIR, J, backupNow };
