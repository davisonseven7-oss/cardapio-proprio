/* Plataforma de cardápios no padrão rede social.
   - /:slug           cardápio público de cada cliente
   - /login           entrada (admin e clientes)
   - /painel          painel do cliente (pedidos, relatórios, cardápio, stories, feed, loja, pixel)
   - /admin           seu painel: clientes, criar, pausar, entrar como cliente */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* .env.local (só no seu computador; no Railway use as Variables) */
try { for (const l of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}

const express = require('express');
const { db, DATA_DIR, J, backupNow } = require('./db');
const { seed } = require('./seed');

const PORT = +process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const TZ = -3; // horário de Brasília/Nordeste (sem horário de verão)
const RESERVED = new Set(['login', 'logout', 'admin', 'painel', 'api', 'static', 'img', 'u', 'favicon.ico', 'robots.txt', 'prototipos', 'pausados']);

/* ---------------- utilidades ---------------- */
const nowLocal = () => new Date(Date.now() + TZ * 36e5);              // "relógio" local em campos UTC
const localDate = iso => new Date(new Date(iso).getTime() + TZ * 36e5).toISOString().slice(0, 10);
function weekKey(d = nowLocal()) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, '0'); }
const lastWeekKey = () => weekKey(new Date(nowLocal().getTime() - 7 * 864e5));
const round2 = v => Math.round(v * 100) / 100;
const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const sha = v => crypto.createHash('sha256').update(String(v)).digest('hex');

function hashPass(p) { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(p, salt, 64).toString('hex'); }
function checkPass(p, h) { const [salt, k] = String(h).split(':'); if (!salt || !k) return false; const a = crypto.scryptSync(p, salt, 64), b = Buffer.from(k, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }

const DEFAULTS = {
  subtitulo: '', cidade: '', logo: '', capa: '', endereco: '', telefone: '', tempoPreparo: 30, tempoEntrega: 40,
  whatsapp: '', enviarWhats: false, atendente: '',
  tema: { cor: '#17603A', destaque: '#FFC53D', acento: '#C9F25C', fonte: 'Shrikhand' },
  horario: { 0: [7, 19], 1: [7, 19], 2: [7, 19], 3: [7, 19], 4: [7, 19], 5: [7, 19], 6: [7, 19] },
  bairros: [], retirada: true, minimo: 0, pagamentos: ['Pix na entrega', 'Cartão (maquininha)', 'Dinheiro'], pixChave: '', pixNome: '', pixAntecipado: false, lojaLat: null, lojaLng: null,
  entrega: { modo: 'bairro', faixas: [[2, 5], [4, 7], [6, 9], [8, 12]], raioMax: 10, fator: 1.3 },
  fidelidade: { tipo: 'off', cashbackPct: 5, cashbackDias: 60, usoMax: 50, selosMeta: 10, selosPremio: 20 },
  promoTemas: ['', '', '', '', '', '', ''],
  curtidas: { meta: 3, desconto: 5, campeao: 20 },
  robo: { nome: 'Atendente', ativo: true },
  pixelId: '', capiToken: '', capiTeste: '',
  mensagens: {
    preparando: 'Oi, {nome}! Seu pedido #{pedido} na {loja} foi aceito e já está em preparo. 👨‍🍳\nAcompanhe aqui: {link}',
    saiu: '{nome}, seu pedido #{pedido} saiu para entrega! 🛵\nTotal: {total} ({pagamento}).\nAcompanhe aqui: {link}',
    pronto: '{nome}, seu pedido #{pedido} está pronto para retirada na {loja}! ✅\nTotal: {total} ({pagamento}).',
    concluido: 'Pedido #{pedido} entregue. Obrigado pela preferência, {nome}! 💚\nVolte sempre: {cardapio}',
    pixConfirmado: 'Pagamento confirmado ✅ {nome}, recebemos seu Pix de {total}. Seu pedido #{pedido} já está em preparo!\nAcompanhe aqui: {link}',
    cancelado: '{nome}, infelizmente seu pedido #{pedido} na {loja} foi cancelado. Se tiver dúvida, é só responder esta mensagem.'
  }
};
const isPickup = o => o.bairro === 'Retirada na loja';
const PIX_AGORA = 'Pix agora (antecipado)';
const payOptions = s => (s.pixAntecipado && s.pixChave ? [PIX_AGORA] : []).concat(s.pagamentos);
const brlS = v => 'R$ ' + (+v || 0).toFixed(2).replace('.', ',');
const baseUrl = req => `${req.protocol}://${req.headers.host}`;
/* mensagem de status para o cliente, com os campos {nome} {pedido} {loja} {total} {pagamento} {link} {cardapio} */
function statusMessage(t, s, o, req) {
  const key = o.status === 'saiu' && isPickup(o) ? 'pronto' : o.status === 'preparando' && o.prev === 'pix' ? 'pixConfirmado' : o.status, tpl = (s.mensagens || {})[key]; if (!tpl) return '';
  const map = { nome: String(o.customer || '').split(' ')[0], pedido: o.num, loja: t.name, total: brlS(o.total), pagamento: o.payment, link: `${baseUrl(req)}/${t.slug}/pedido/${o.track}`, cardapio: `${baseUrl(req)}/${t.slug}` };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => map[k] != null ? String(map[k]) : m);
}
const waLink = (phone, text) => { let p = String(phone || '').replace(/\D/g, ''); if (p.length <= 11) p = '55' + p; return `https://wa.me/${p}?text=${encodeURIComponent(text)}`; };
const OLD_PAY = 'Pix|Cartão|Dinheiro';
const settingsOf = t => { const s = J(t.settings, {}); if (Array.isArray(s.pagamentos) && s.pagamentos.join('|') === OLD_PAY) s.pagamentos = DEFAULTS.pagamentos; return { ...DEFAULTS, ...s, tema: { ...DEFAULTS.tema, ...(s.tema || {}) }, curtidas: { ...DEFAULTS.curtidas, ...(s.curtidas || {}) }, robo: { ...DEFAULTS.robo, ...(s.robo || {}) }, mensagens: { ...DEFAULTS.mensagens, ...(s.mensagens || {}) }, entrega: { ...DEFAULTS.entrega, ...(s.entrega || {}) }, fidelidade: { ...DEFAULTS.fidelidade, ...(s.fidelidade || {}) } }; };

const tenantBySlug = slug => db.prepare('SELECT * FROM tenants WHERE slug=?').get(String(slug || '').toLowerCase());
const tenantById = id => db.prepare('SELECT * FROM tenants WHERE id=?').get(id);

/* campeão da semana passada (ganha desconto nesta semana) */
function champion(tid) {
  const r = db.prepare(`SELECT l.product_id id, COUNT(*) n FROM likes l JOIN products p ON p.id=l.product_id AND p.active=1
    WHERE l.tenant_id=? AND l.week=? GROUP BY l.product_id ORDER BY n DESC LIMIT 1`).get(tid, lastWeekKey());
  return r ? r.id : null;
}
/* preço que vale agora: promo do dia, campeão da semana; atacado é aplicado por quantidade */
function priceInfo(p, dow, champId, s) {
  let price = p.price, old = null, why = '';
  const days = J(p.promo_days, []);
  if (p.promo_price != null && p.promo_price < p.price && (!days.length || days.includes(dow))) { price = p.promo_price; old = p.price; why = 'promo'; }
  if (champId === p.id) { const c = round2(p.price * (1 - s.curtidas.campeao / 100)); if (c < price) { price = c; old = p.price; why = 'campeao'; } }
  return { price, old, why };
}
function unitFor(p, info, qty) { return p.bulk_qty && p.bulk_price != null && qty >= p.bulk_qty ? Math.min(info.price, p.bulk_price) : info.price; }

/* ---------------- app ---------------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });

/* sessão por cookie */
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(a => a[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
function session(req) {
  const tok = cookies(req).sid; if (!tok) return null;
  const s = db.prepare('SELECT s.*, u.email, u.name, u.role, u.tenant_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=?').get(tok);
  if (!s || s.expires_at < Date.now()) return null;
  return s;
}
function setCookie(res, v, maxAge) { res.setHeader('Set-Cookie', `sid=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${PROD ? '; Secure' : ''}`); }
const sameOrigin = req => { const o = req.headers.origin; return !o || o === `${req.protocol}://${req.headers.host}`; };

function auth(role) {
  return (req, res, next) => {
    if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ erro: 'Origem inválida' });
    const s = session(req); if (!s) return res.status(401).json({ erro: 'Faça login de novo' });
    if (role === 'admin' && s.role !== 'admin') return res.status(403).json({ erro: 'Só o administrador' });
    req.s = s;
    if (role === 'painel') {
      req.tid = s.role === 'admin' ? s.acting_tenant : s.tenant_id;
      if (!req.tid) return res.status(400).json({ erro: 'Escolha um cliente no painel admin' });
      req.tenant = tenantById(req.tid); if (!req.tenant) return res.status(404).json({ erro: 'Cliente não encontrado' });
    }
    next();
  };
}

/* login com limite de tentativas */
const tries = new Map();
app.post('/api/login', (req, res) => {
  const ip = req.ip, t = tries.get(ip) || { n: 0, at: Date.now() };
  if (Date.now() - t.at > 15 * 6e4) { t.n = 0; t.at = Date.now(); }
  if (t.n >= 10) return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos.' });
  const { email, senha } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
  if (!u || !checkPass(String(senha || ''), u.pass_hash)) { t.n++; tries.set(ip, t); return res.status(401).json({ erro: 'E-mail ou senha incorretos' }); }
  tries.delete(ip);
  const tok = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(tok, u.id, Date.now() + 30 * 864e5);
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
  setCookie(res, tok, 30 * 86400);
  res.json({ ok: true, destino: u.role === 'admin' ? '/admin' : '/painel' });
});
app.post('/api/logout', (req, res) => { const tok = cookies(req).sid; if (tok) db.prepare('DELETE FROM sessions WHERE token=?').run(tok); setCookie(res, '', 0); res.json({ ok: true }); });
app.get('/api/me', (req, res) => {
  const s = session(req); if (!s) return res.status(401).json({ erro: 'sem sessão' });
  const tid = s.role === 'admin' ? s.acting_tenant : s.tenant_id, t = tid ? tenantById(tid) : null;
  res.json({ email: s.email, nome: s.name, role: s.role, tenant: t ? { id: t.id, slug: t.slug, name: t.name, status: t.status } : null });
});

/* ---------------- cardápio público ---------------- */
function menuPayload(t, visitor) {
  const s = settingsOf(t), dow = nowLocal().getUTCDay(), wk = weekKey(), champ = champion(t.id);
  const brands = db.prepare('SELECT id,name,sub,logo FROM brands WHERE tenant_id=? ORDER BY sort,id').all(t.id);
  const cats = db.prepare('SELECT id,brand_id,name,icon FROM categories WHERE tenant_id=? AND active=1 ORDER BY sort,id').all(t.id);
  const prods = db.prepare('SELECT * FROM products WHERE tenant_id=? AND active=1 ORDER BY sort,id').all(t.id).map(p => {
    const i = priceInfo(p, dow, champ, s);
    return { id: p.id, cat: p.category_id, name: p.name, desc: p.descr, price: i.price, old: i.old, why: i.why, base: p.price, bulk: p.bulk_qty ? [p.bulk_qty, p.bulk_price] : null, img: p.img, icon: p.icon, tag: p.tag, opts: J(p.options, []), kw: p.keywords, promoLabel: p.promo_label };
  });
  const counts = Object.fromEntries(db.prepare('SELECT product_id id, COUNT(*) n FROM likes WHERE tenant_id=? AND week=? GROUP BY product_id').all(t.id, wk).map(r => [r.id, r.n]));
  const mine = visitor ? db.prepare('SELECT product_id FROM likes WHERE tenant_id=? AND week=? AND visitor=?').all(t.id, wk, visitor).map(r => r.product_id) : [];
  const stories = db.prepare('SELECT id,name,cover,slides FROM stories WHERE tenant_id=? AND active=1 ORDER BY sort,id').all(t.id).map(x => ({ ...x, slides: J(x.slides, []) }));
  const posts = db.prepare('SELECT id,img,product_id prod,caption,overlay,created_at FROM posts WHERE tenant_id=? AND active=1 ORDER BY created_at DESC LIMIT 30').all(t.id);
  const pub = { entrega: { modo: s.entrega.modo, raioMax: s.entrega.raioMax }, fidelidade: { tipo: s.fidelidade.tipo, cashbackPct: s.fidelidade.cashbackPct, selosMeta: s.fidelidade.selosMeta, selosPremio: s.fidelidade.selosPremio }, temCupom: !!db.prepare('SELECT 1 FROM coupons WHERE tenant_id=? AND ativo=1').get(t.id), pixChave: s.pixChave, pixNome: s.pixNome, pixAntecipado: !!(s.pixAntecipado && s.pixChave), subtitulo: s.subtitulo, cidade: s.cidade, logo: s.logo, endereco: s.endereco, tempoPreparo: s.tempoPreparo, tempoEntrega: s.tempoEntrega, tema: s.tema, horario: s.horario, bairros: s.bairros, retirada: s.retirada, minimo: s.minimo, pagamentos: payOptions(s), curtidas: s.curtidas, robo: s.robo, temaHoje: s.promoTemas[dow] || '', whatsapp: s.whatsapp ? true : false, atendente: s.atendente, pixelId: s.pixelId };
  return { loja: { slug: t.slug, name: t.name, ...pub }, brands, cats, prods, stories, posts, likes: { counts, mine, week: wk }, champion: champ, dow, agora: nowLocal().toISOString() };
}
const visitorOk = v => typeof v === 'string' && /^[a-z0-9]{8,40}$/i.test(v);

app.get('/api/m/:slug', (req, res) => {
  const t = tenantBySlug(req.params.slug); if (!t) return res.status(404).json({ erro: 'Cardápio não encontrado' });
  if (t.status !== 'ativo') return res.status(423).json({ erro: 'pausado', name: t.name });
  res.json(menuPayload(t, visitorOk(req.query.v) ? req.query.v : null));
});
app.post('/api/m/:slug/like', (req, res) => {
  const t = tenantBySlug(req.params.slug); if (!t || t.status !== 'ativo') return res.status(404).end();
  const { product, visitor, on } = req.body || {}; if (!visitorOk(visitor)) return res.status(400).json({ erro: 'visitante' });
  const p = db.prepare('SELECT id FROM products WHERE id=? AND tenant_id=?').get(+product, t.id); if (!p) return res.status(404).end();
  const wk = weekKey();
  if (on) db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?,?,?)').run(t.id, p.id, visitor, wk);
  else db.prepare('DELETE FROM likes WHERE tenant_id=? AND product_id=? AND visitor=? AND week=?').run(t.id, p.id, visitor, wk);
  const n = db.prepare('SELECT COUNT(*) n FROM likes WHERE tenant_id=? AND product_id=? AND week=?').get(t.id, p.id, wk).n;
  res.json({ n });
});
const EV = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Contact', 'Story', 'Like']);
app.post('/api/m/:slug/ev', (req, res) => {
  const t = tenantBySlug(req.params.slug); if (!t) return res.status(404).end();
  const { type, info, eventId, data, fbp, fbc, url } = req.body || {}; if (!EV.has(type)) return res.status(400).end();
  db.prepare('INSERT INTO events(tenant_id,type,info) VALUES(?,?,?)').run(t.id, type, String(info || '').slice(0, 120));
  if (t.status === 'ativo' && /^[\w-]{6,80}$/.test(String(eventId || ''))) {
    const cd = data && typeof data === 'object' ? Object.fromEntries(Object.entries(data).filter(([k]) => ['value', 'currency', 'content_ids', 'content_type', 'content_name', 'num_items'].includes(k)).slice(0, 6)) : undefined;
    sendCapiEvent(t, settingsOf(t), { name: type, eventId: String(eventId), req, fbp: typeof fbp === 'string' ? fbp.slice(0, 120) : '', fbc: typeof fbc === 'string' ? fbc.slice(0, 200) : '', url: typeof url === 'string' && url.startsWith(baseUrl(req)) ? url.slice(0, 300) : '', user: visitorOk(req.body.visitor) ? { externalId: req.body.visitor } : {}, custom: cd }).catch(() => {});
  }
  res.json({ ok: true });
});

/* =====================================================================
   PREÇO DO PEDIDO (usado para mostrar o total na sacola e para gravar o pedido)
   - complementos com mínimo/máximo e regra de preço (soma, maior, média = meio a meio)
   - curtidas, cupom, selos de fidelidade, cashback
   - taxa por bairro ou por distância (CEP + mapa)
   ===================================================================== */
/* grupo de opções: min/max/regra (pedidos antigos: escolha 1 obrigatória) */
const groupOf = g => ({ nome: g.nome, itens: g.itens || [], min: g.min ?? 1, max: g.max ?? 1, regra: g.regra || 'soma' });
function pickOptions(p, raw) {
  const groups = J(p.options, []).map(groupOf); let extra = 0; const labels = [], sel = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]; let s = raw && raw[gi]; s = Array.isArray(s) ? s : s == null || s === '' ? [] : [s];
    s = [...new Set(s.map(Number).filter(i => Number.isInteger(i) && g.itens[i]))];
    if (s.length < g.min) return { erro: `Escolha ${g.min > 1 ? 'pelo menos ' + g.min + ' opções' : 'uma opção'} em "${g.nome}" (${p.name})` };
    if (s.length > g.max) return { erro: `Escolha no máximo ${g.max} em "${g.nome}" (${p.name})` };
    const ex = s.map(i => +g.itens[i][1] || 0);
    extra += !ex.length ? 0 : g.regra === 'maior' ? Math.max(...ex) : g.regra === 'media' ? ex.reduce((a, b) => a + b, 0) / ex.length : ex.reduce((a, b) => a + b, 0);
    if (s.length) labels.push(`${g.nome}: ${s.map(i => g.itens[i][0]).join(g.regra === 'soma' ? ', ' : ' + ')}`);
    sel.push(s);
  }
  return { extra: round2(extra), labels, sel };
}

/* ---- endereço: CEP (ViaCEP) e mapa (OpenStreetMap / Nominatim), com cache ---- */
const UA = 'Huntix/1.0 (+https://huntixdelivery.up.railway.app)';
let geoQueue = Promise.resolve();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function viaCep(cep) {
  const c = String(cep || '').replace(/\D/g, ''); if (c.length !== 8) return null;
  try { const r = await fetch(`https://viacep.com.br/ws/${c}/json/`, { signal: AbortSignal.timeout(6000) }); const j = await r.json(); return j.erro ? null : j; } catch { return null; }
}
async function geocode(params) {
  const key = JSON.stringify(params); const hit = db.prepare('SELECT lat,lng,created_at FROM geocache WHERE q=?').get(key);
  /* resultado vazio fica guardado só 1 dia (o mapa do OpenStreetMap é atualizado) */
  if (hit && (hit.lat != null || Date.now() - new Date(hit.created_at) < 864e5)) return hit.lat == null ? null : { lat: hit.lat, lng: hit.lng };
  /* Nominatim pede no máximo 1 consulta por segundo */
  const job = geoQueue.then(async () => {
    const u = new URL('https://nominatim.openstreetmap.org/search'); u.searchParams.set('format', 'json'); u.searchParams.set('limit', '1'); u.searchParams.set('countrycodes', 'br');
    Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
    try { const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(8000) }); const j = await r.json(); return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; }
    catch { return undefined; } finally { await sleep(1100); }
  });
  geoQueue = job.catch(() => {});
  const res = await job; if (res !== undefined) db.prepare('INSERT OR REPLACE INTO geocache(q,lat,lng) VALUES(?,?,?)').run(key, res ? res.lat : null, res ? res.lng : null);
  return res || null;
}
async function locate({ cep, rua, numero, bairro, cidade, uf }) {
  const tries = [
    rua && cidade ? { street: `${numero ? numero + ' ' : ''}${rua}`, city: cidade, state: uf, country: 'Brasil' } : null,
    rua && cidade ? { street: rua, city: cidade, state: uf, country: 'Brasil' } : null,
    cep ? { postalcode: cep, country: 'Brasil' } : null,
    bairro && cidade ? { q: `${bairro}, ${cidade}, ${uf || ''}, Brasil` } : null];
  for (const t of tries.filter(Boolean)) { const g = await geocode(t); if (g) return g; }
  return null;
}
const haversine = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/* ---- fidelidade ---- */
const nowIso = () => new Date().toISOString();
function cashbackSaldo(tid, phone) {
  if (!phone) return 0;
  const r = db.prepare(`SELECT COALESCE(SUM(valor),0) v FROM cashback WHERE tenant_id=? AND phone=? AND tipo!='selo' AND (expira IS NULL OR expira>?)`).get(tid, phone, nowIso());
  return Math.max(0, round2(r.v));
}
function selosInfo(tid, phone, meta) {
  if (!phone || !meta) return { feitos: 0, faltam: meta, premio: false };
  const feitos = db.prepare(`SELECT COUNT(*) n FROM orders WHERE tenant_id=? AND phone=? AND status='concluido'`).get(tid, phone).n;
  const usados = db.prepare(`SELECT COUNT(*) n FROM cashback WHERE tenant_id=? AND phone=? AND tipo='selo'`).get(tid, phone).n;
  const ciclo = feitos - usados * meta;
  return { feitos: Math.max(0, ciclo % meta + (ciclo >= meta ? meta : 0)), faltam: Math.max(0, meta - ciclo), premio: ciclo >= meta };
}

/* ---- cupom ---- */
function checkCoupon(t, code, subtotal, phone) {
  const c = db.prepare('SELECT * FROM coupons WHERE tenant_id=? AND code=? COLLATE NOCASE').get(t.id, String(code || '').trim().toUpperCase());
  if (!c || !c.ativo) return { erro: 'Cupom não encontrado' };
  const hoje = nowLocal().toISOString().slice(0, 10);
  if (c.inicio && hoje < c.inicio) return { erro: 'Esse cupom ainda não começou' };
  if (c.fim && hoje > c.fim) return { erro: 'Esse cupom expirou' };
  if (c.minimo && subtotal < c.minimo) return { erro: `Cupom válido para pedidos a partir de R$ ${c.minimo.toFixed(2).replace('.', ',')}` };
  const usos = db.prepare(`SELECT COUNT(*) n FROM orders WHERE tenant_id=? AND coupon=? AND status!='cancelado'`).get(t.id, c.code).n;
  if (c.max_usos && usos >= c.max_usos) return { erro: 'Esse cupom já esgotou' };
  if (phone) {
    if (c.por_cliente) { const meus = db.prepare(`SELECT COUNT(*) n FROM orders WHERE tenant_id=? AND coupon=? AND phone=? AND status!='cancelado'`).get(t.id, c.code, phone).n; if (meus >= c.por_cliente) return { erro: 'Você já usou esse cupom' }; }
    if (c.primeira) { const n = db.prepare(`SELECT COUNT(*) n FROM orders WHERE tenant_id=? AND phone=? AND status!='cancelado'`).get(t.id, phone).n; if (n > 0) return { erro: 'Cupom só para a primeira compra' }; }
  } else if (c.primeira || c.por_cliente) return { cupom: c, precisaFone: true };
  return { cupom: c };
}

/* ---- cotação completa ---- */
async function quote(t, b) {
  const s = settingsOf(t), dow = nowLocal().getUTCDay(), champ = champion(t.id), E = s.entrega, F = s.fidelidade;
  const fone = phoneNorm(b.telefone), phone = fone.length >= 10 ? fone : '';
  const raw = Array.isArray(b.itens) ? b.itens.slice(0, 60) : []; if (!raw.length) return { erro: 'Sacola vazia' };
  const prodQty = {}, lines = [];
  for (const it of raw) {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND tenant_id=? AND active=1').get(+it.id, t.id); if (!p) return { erro: 'Um produto saiu do cardápio. Atualize a página.' };
    const qty = Math.max(1, Math.min(999, +it.qty | 0)), o = pickOptions(p, it.opts); if (o.erro) return { erro: o.erro };
    prodQty[p.id] = (prodQty[p.id] || 0) + qty; lines.push({ p, qty, ...o });
  }
  const items = lines.map(({ p, qty, extra, labels }) => { const info = priceInfo(p, dow, champ, s), unit = round2(unitFor(p, info, prodQty[p.id]) + extra); return { id: p.id, nome: p.name, desc: p.descr || '', qty, unit, opts: labels, total: round2(unit * qty) }; });
  const subtotal = round2(items.reduce((a, i) => a + i.total, 0));
  const descontos = [], avisos = [];
  /* curtidas */
  if (visitorOk(b.visitor) && s.curtidas.meta > 0) { const n = db.prepare('SELECT COUNT(*) n FROM likes WHERE tenant_id=? AND visitor=? AND week=?').get(t.id, b.visitor, weekKey()).n; if (n >= s.curtidas.meta) descontos.push({ tipo: 'curtidas', label: `Curtiu e ganhou (${s.curtidas.desconto}%)`, valor: round2(subtotal * s.curtidas.desconto / 100) }); }
  /* entrega */
  const retirada = b.bairro === '__retirada' && s.retirada;
  let fee = 0, km = null, bairroLabel = '', cepInfo = null, erroEntrega = null;
  const cep = String(b.cep || '').replace(/\D/g, '');
  if (retirada) bairroLabel = 'Retirada na loja';
  else if (E.modo === 'distancia') {
    if (cep.length !== 8) erroEntrega = 'Coloque o CEP para calcular a entrega';
    else {
      cepInfo = await viaCep(cep);
      if (!cepInfo) erroEntrega = 'CEP não encontrado';
      else if (!(s.lojaLat && s.lojaLng)) erroEntrega = 'A loja ainda não configurou a localização para entrega';
      else {
        bairroLabel = cepInfo.bairro || b.bairroTxt || cepInfo.localidade;
        const g = await locate({ cep, rua: b.endereco || cepInfo.logradouro, numero: b.numero, bairro: cepInfo.bairro, cidade: cepInfo.localidade, uf: cepInfo.uf });
        if (!g) { const bb = s.bairros.find(x => x[0].toLowerCase() === String(cepInfo.bairro || '').toLowerCase()); if (bb) { fee = +bb[1] || 0; avisos.push('Taxa pelo bairro (endereço não achado no mapa)'); } else erroEntrega = 'Não achamos esse endereço no mapa. Confira a rua e o número.'; }
        else {
          km = round2(haversine({ lat: s.lojaLat, lng: s.lojaLng }, g) * (+E.fator || 1.3));
          if (E.raioMax && km > E.raioMax) erroEntrega = `Endereço fora da área de entrega (${km.toFixed(1).replace('.', ',')} km; até ${E.raioMax} km)`;
          else { const f = (E.faixas || []).slice().sort((a, b) => a[0] - b[0]).find(x => km <= x[0]); if (f) fee = +f[1] || 0; else erroEntrega = `Endereço fora da área de entrega (${km.toFixed(1).replace('.', ',')} km)`; }
        }
      }
    }
  } else {
    const bb = s.bairros.find(x => x[0] === b.bairro); if (!bb) erroEntrega = 'Escolha o bairro de entrega'; else { fee = +bb[1] || 0; bairroLabel = bb[0]; }
  }
  /* cupom */
  let coupon = '', cupomErro = null;
  if (b.cupom) {
    const r = checkCoupon(t, b.cupom, subtotal, phone);
    if (r.erro) cupomErro = r.erro;
    else { const c = r.cupom; coupon = c.code; if (r.precisaFone) avisos.push('Coloque seu WhatsApp para validar o cupom');
      const v = c.tipo === 'frete' ? fee : c.tipo === 'valor' ? Math.min(c.valor, subtotal) : round2(subtotal * c.valor / 100);
      descontos.push({ tipo: 'cupom', label: `Cupom ${c.code}${c.tipo === 'frete' ? ' (frete grátis)' : c.tipo === 'percent' ? ` (${c.valor}%)` : ''}`, valor: round2(v) }); }
  }
  /* fidelidade: selos (a cada N pedidos, um prêmio) */
  let selos = null;
  if (F.tipo === 'selos' && F.selosMeta > 0) {
    selos = selosInfo(t.id, phone, F.selosMeta);
    if (selos.premio) descontos.push({ tipo: 'selo', label: `Prêmio fidelidade (${F.selosMeta} pedidos)`, valor: round2(Math.min(+F.selosPremio || 0, subtotal)) });
  }
  /* cashback */
  let saldo = 0, cashbackUsado = 0;
  if (F.tipo === 'cashback') {
    saldo = cashbackSaldo(t.id, phone);
    if (b.usarCashback && saldo > 0) {
      const jaDesc = descontos.reduce((a, d) => a + d.valor, 0), base = Math.max(0, subtotal - jaDesc), teto = round2(base * (+F.usoMax || 100) / 100);
      cashbackUsado = round2(Math.min(saldo, teto)); if (cashbackUsado > 0) descontos.push({ tipo: 'cashback', label: 'Cashback usado', valor: cashbackUsado });
    }
  }
  const discount = round2(Math.min(subtotal + fee, descontos.reduce((a, d) => a + d.valor, 0)));
  const total = round2(subtotal - discount + fee);
  const ganhaCashback = F.tipo === 'cashback' ? round2(Math.max(0, subtotal - discount) * (+F.cashbackPct || 0) / 100) : 0;
  return { ok: true, items, subtotal, descontos, discount, fee, km, total, retirada, bairroLabel, cep, cepInfo, coupon, cupomErro, erroEntrega, avisos,
    minimoErro: !retirada && s.minimo && subtotal < s.minimo ? `Pedido mínimo para entrega: R$ ${s.minimo.toFixed(2).replace('.', ',')}` : null,
    fidelidade: { tipo: F.tipo, saldo, cashbackUsado, ganhaCashback, selos, meta: F.selosMeta, premio: F.selosPremio }, phone, s };
}

app.post('/api/m/:slug/cotar', async (req, res) => {
  const t = tenantBySlug(req.params.slug); if (!t || t.status !== 'ativo') return res.status(404).json({ erro: 'Cardápio indisponível' });
  const q = await quote(t, req.body || {}); if (q.erro) return res.status(400).json({ erro: q.erro });
  const { s, cepInfo, ...out } = q;
  res.json({ ...out, endereco: cepInfo ? { rua: cepInfo.logradouro, bairro: cepInfo.bairro, cidade: cepInfo.localidade, uf: cepInfo.uf } : null });
});

app.post('/api/m/:slug/order', async (req, res) => {
  const t = tenantBySlug(req.params.slug); if (!t || t.status !== 'ativo') return res.status(404).json({ erro: 'Cardápio indisponível' });
  const b = req.body || {}, nome = String(b.nome || '').trim().slice(0, 80), fone = phoneNorm(b.telefone);
  if (!nome) return res.status(400).json({ erro: 'Coloque seu nome' });
  if (fone.length < 10) return res.status(400).json({ erro: 'Coloque um WhatsApp com DDD' });
  const q = await quote(t, b); if (q.erro) return res.status(400).json({ erro: q.erro });
  const s = q.s, retirada = q.retirada;
  if (q.erroEntrega) return res.status(400).json({ erro: q.erroEntrega });
  if (q.minimoErro) return res.status(400).json({ erro: q.minimoErro });
  if (b.cupom && q.cupomErro) return res.status(400).json({ erro: q.cupomErro });
  /* endereço em partes: rua, número, complemento, referência */
  const cut = (v, n) => String(v || '').trim().slice(0, n);
  const rua = cut(b.endereco, 140), numero = cut(b.numero, 12), compl = cut(b.complemento, 60), ref = cut(b.referencia, 100);
  if (!retirada && !rua) return res.status(400).json({ erro: 'Coloque a rua do endereço' });
  if (!retirada && !numero && !/\d/.test(rua)) return res.status(400).json({ erro: 'Coloque o número da casa (ou S/N)' });
  const cidadeTxt = q.cepInfo ? `, ${q.cepInfo.localidade}` : '';
  const endereco = retirada ? '' : `${rua}${numero ? ', ' + numero : ''}${compl ? ' - ' + compl : ''}${ref ? ' (Ref.: ' + ref + ')' : ''}${q.cep ? ` · CEP ${q.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : ''}`;
  const opts = payOptions(s), pixFirst = b.pagamento === PIX_AGORA && opts.includes(PIX_AGORA);
  let pay = pixFirst ? 'Pix antecipado' : s.pagamentos.includes(b.pagamento) ? b.pagamento : s.pagamentos[0];
  const status0 = pixFirst ? 'pix' : 'novo';
  const troco = +String(b.troco || '').replace(/[^\d,.]/g, '').replace(',', '.');
  if (/dinheiro/i.test(pay) && troco > 0) pay += ` (troco p/ R$ ${troco.toFixed(2).replace('.', ',')})`;
  const { items, subtotal, discount, fee, total, descontos } = q;
  const bairro = retirada ? 'Retirada na loja' : q.bairroLabel;
  const num = (db.prepare('SELECT MAX(num) m FROM orders WHERE tenant_id=?').get(t.id).m || 0) + 1;
  const track = crypto.randomBytes(8).toString('base64url'), trackUrl = `${baseUrl(req)}/${t.slug}/pedido/${track}`;
  db.exec('BEGIN');
  let r;
  try {
    r = db.prepare('INSERT INTO orders(tenant_id,num,customer,phone,address,bairro,payment,notes,items,subtotal,discount,fee,total,visitor,source,track,log,status,coupon,descontos,cashback_usado,km,cep) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(t.id, num, nome, fone, endereco, bairro, pay, String(b.obs || '').slice(0, 300), JSON.stringify(items), subtotal, discount, fee, total, visitorOk(b.visitor) ? b.visitor : null, String(b.origem || '').slice(0, 120), track, JSON.stringify([{ s: status0, t: nowIso() }]), status0, q.coupon, JSON.stringify(descontos), q.fidelidade.cashbackUsado, q.km, q.cep);
    const oid = r.lastInsertRowid;
    if (q.fidelidade.cashbackUsado > 0) db.prepare(`INSERT INTO cashback(tenant_id,phone,valor,tipo,order_id) VALUES(?,?,?,'uso',?)`).run(t.id, fone, -q.fidelidade.cashbackUsado, oid);
    if (descontos.some(d => d.tipo === 'selo')) db.prepare(`INSERT INTO cashback(tenant_id,phone,valor,tipo,order_id) VALUES(?,?,0,'selo',?)`).run(t.id, fone, oid);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); console.error('pedido', e); return res.status(500).json({ erro: 'Não deu para salvar o pedido. Tente de novo.' }); }
  const brl = v => 'R$ ' + v.toFixed(2).replace('.', ',');
  const msg = `*Pedido #${num} · ${t.name}*\n\n` + items.map(i => `${i.qty}× ${i.nome} — ${brl(i.total)}${i.opts.length ? `\n   ${i.opts.join(' · ')}` : ''}`).join('\n') +
    `\n\nSubtotal: ${brl(subtotal)}${descontos.map(d => `\n${d.label}: − ${brl(d.valor)}`).join('')}\n${retirada ? 'Retirada na loja' : `Entrega (${bairro}${q.km != null ? ` · ${q.km.toFixed(1).replace('.', ',')} km` : ''}): ${brl(fee)}`}\n*Total: ${brl(total)}*\n\nNome: ${nome}\nWhatsApp: ${fone}${retirada ? '' : `\nEndereço: ${endereco}, ${bairro}${cidadeTxt}`}\nPagamento: ${pay}${pixFirst ? ' — aguardando confirmação da loja' : /entrega|retirada/i.test(pay) ? '' : ` (na ${retirada ? 'retirada' : 'entrega'})`}${/pix/i.test(pay) && s.pixChave ? `\nChave Pix da loja: ${s.pixChave}${s.pixNome ? ' · ' + s.pixNome : ''}` : ''}${b.obs ? `\nObs.: ${String(b.obs).slice(0, 300)}` : ''}\n\nAcompanhar pedido: ${trackUrl}`;
  try { upsertCustomer(t.id, { phone: fone, name: nome, address: endereco, bairro: retirada ? '' : bairro }); } catch (e) { console.error('cliente', e.message); }
  const eventId = `${t.slug}-${num}`;
  if (s.pixelId && s.capiToken) sendCapi(t, s, { eventId, total, items, fone, nome, req, fbp: b.fbp, fbc: b.fbc, num, cupom: q.coupon, pagamento: pay, cidade: q.cepInfo && q.cepInfo.localidade, uf: q.cepInfo && q.cepInfo.uf, cep: q.cep, visitor: visitorOk(b.visitor) ? b.visitor : null }).catch(() => {});
  res.json({ ok: true, id: r.lastInsertRowid, num, total, eventId, msg, track, trackUrl, status: status0, ganhaCashback: q.fidelidade.ganhaCashback, pix: pixFirst ? { chave: s.pixChave, nome: s.pixNome, whatsapp: s.whatsapp || '' } : null, whats: s.whatsapp && s.enviarWhats ? `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` : null });
});

/* fidelidade ao mudar status: credita cashback ao concluir; devolve ao cancelar */
function loyaltyOnStatus(t, o, st) {
  const F = settingsOf(t).fidelidade;
  if (st === 'concluido' && F.tipo === 'cashback' && +F.cashbackPct > 0 && o.phone && !db.prepare(`SELECT 1 FROM cashback WHERE order_id=? AND tipo='ganho'`).get(o.id)) {
    const v = round2(Math.max(0, o.subtotal - o.discount) * F.cashbackPct / 100);
    if (v > 0) { db.prepare(`INSERT INTO cashback(tenant_id,phone,valor,tipo,order_id,expira) VALUES(?,?,?,'ganho',?,?)`).run(t.id, o.phone, v, o.id, F.cashbackDias ? new Date(Date.now() + F.cashbackDias * 864e5).toISOString() : null); return v; }
  }
  if (st === 'cancelado') {
    db.prepare(`DELETE FROM cashback WHERE order_id=? AND tipo IN ('selo','ganho')`).run(o.id);
    const uso = db.prepare(`SELECT COALESCE(SUM(valor),0) v FROM cashback WHERE order_id=? AND tipo IN ('uso','estorno')`).get(o.id).v;
    if (uso < 0) db.prepare(`INSERT INTO cashback(tenant_id,phone,valor,tipo,order_id) VALUES(?,?,?,'estorno',?)`).run(t.id, o.phone, -uso, o.id);
  }
  return 0;
}

/* =====================================================================
   API de Conversões da Meta: todos os eventos do funil também pelo servidor.
   Cada evento usa o MESMO event_id do Pixel no navegador, então a Meta junta os
   dois e não conta em dobro. Isso recupera vendas que o bloqueador de anúncios
   ou o iPhone escondem do Pixel.
   ===================================================================== */
const CAPI_STD = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Contact', 'Purchase']);
const normTxt = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
async function sendCapiEvent(t, s, ev) {
  if (!s.pixelId || !s.capiToken || !CAPI_STD.has(ev.name)) return;
  const u = ev.user || {}, req = ev.req;
  const user_data = {
    client_ip_address: req.ip, client_user_agent: req.headers['user-agent'] || '',
    ...(ev.fbp ? { fbp: ev.fbp } : {}), ...(ev.fbc ? { fbc: ev.fbc } : {}),
    ...(u.phone ? { ph: [sha(u.phone.startsWith('55') ? u.phone : '55' + u.phone)] } : {}),
    ...(u.fn ? { fn: [sha(normTxt(u.fn))] } : {}), ...(u.ln ? { ln: [sha(normTxt(u.ln))] } : {}),
    ...(u.ct ? { ct: [sha(normTxt(u.ct))] } : {}), ...(u.st ? { st: [sha(normTxt(u.st))] } : {}),
    ...(u.zp ? { zp: [sha(String(u.zp).replace(/\D/g, ''))] } : {}), country: [sha('br')],
    ...(u.externalId ? { external_id: [sha(u.externalId)] } : {})
  };
  const body = { data: [{ event_name: ev.name, event_time: Math.floor(Date.now() / 1000), event_id: ev.eventId, action_source: 'website',
    event_source_url: ev.url || `${baseUrl(req)}/${t.slug}`, user_data, ...(ev.custom ? { custom_data: ev.custom } : {}) }],
    ...(s.capiTeste ? { test_event_code: s.capiTeste } : {}) };
  let info;
  if (process.env.CAPI_DRYRUN === '1') info = 'teste local (não enviado)';
  else try { const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(s.pixelId)}/events?access_token=${encodeURIComponent(s.capiToken)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); info = r.ok ? 'ok' : `erro ${r.status}: ${(await r.text()).slice(0, 100)}`; }
  catch (e) { info = 'erro: ' + e.message; }
  db.prepare('INSERT INTO events(tenant_id,type,info) VALUES(?,?,?)').run(t.id, 'CAPI', `${ev.name} · ${ev.name === 'Purchase' ? ev.eventId + ' · ' + brlS(ev.custom && ev.custom.value) + ' · ' : ''}${info}`);
  if (process.env.CAPI_DRYRUN === '1') console.log('[CAPI]', JSON.stringify(body.data[0]));
}
/* compra: dados completos para a Meta casar a venda com quem viu o anúncio */
async function sendCapi(t, s, o) {
  const [fn, ...ln] = String(o.nome || '').trim().split(/\s+/);
  await sendCapiEvent(t, s, { name: 'Purchase', eventId: o.eventId, req: o.req, fbp: o.fbp, fbc: o.fbc,
    user: { phone: o.fone, fn, ln: ln.join(' '), ct: o.cidade, st: o.uf, zp: o.cep, externalId: o.visitor || o.fone },
    custom: { currency: 'BRL', value: o.total, content_type: 'product', order_id: String(o.num), num_items: o.items.reduce((a, i) => a + i.qty, 0),
      content_ids: o.items.map(i => String(i.id)), contents: o.items.map(i => ({ id: String(i.id), quantity: i.qty, item_price: i.unit })),
      ...(o.cupom ? { coupon: o.cupom } : {}), ...(o.pagamento ? { payment_method: o.pagamento } : {}) } });
}

/* ---------------- painel do cliente ---------------- */
const P = auth('painel');
app.get('/api/p/loja', P, (req, res) => { const t = req.tenant; res.json({ id: t.id, slug: t.slug, name: t.name, status: t.status, settings: settingsOf(t) }); });
app.put('/api/p/loja', P, (req, res) => {
  const b = req.body || {}, cur = settingsOf(req.tenant), n = b.settings || {};
  const keep = ['subtitulo', 'cidade', 'logo', 'endereco', 'telefone', 'tempoPreparo', 'tempoEntrega', 'whatsapp', 'enviarWhats', 'atendente', 'tema', 'horario', 'bairros', 'retirada', 'minimo', 'pagamentos', 'promoTemas', 'curtidas', 'robo', 'pixelId', 'capiToken', 'capiTeste', 'mensagens', 'pixChave', 'pixNome', 'pixAntecipado', 'entrega', 'fidelidade', 'lojaLat', 'lojaLng'];
  const out = { ...cur }; keep.forEach(k => { if (k in n) out[k] = n[k]; });
  out.minimo = +out.minimo || 0; out.bairros = (out.bairros || []).filter(x => x && x[0]).map(([a, v]) => [String(a).slice(0, 60), +v || 0]);
  out.pixelId = String(out.pixelId || '').replace(/\D/g, ''); out.whatsapp = String(out.whatsapp || '').replace(/\D/g, '');
  db.prepare('UPDATE tenants SET name=?, settings=? WHERE id=?').run(String(b.name || req.tenant.name).slice(0, 80), JSON.stringify(out), req.tid);
  res.json({ ok: true });
});
app.post('/api/p/senha', P, (req, res) => {
  if (req.s.role !== 'cliente') return res.status(400).json({ erro: 'Use o painel admin para senhas' });
  const { atual, nova } = req.body || {}; const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.s.user_id);
  if (!checkPass(String(atual || ''), u.pass_hash)) return res.status(400).json({ erro: 'Senha atual incorreta' });
  if (String(nova || '').length < 8) return res.status(400).json({ erro: 'A nova senha precisa de 8 caracteres ou mais' });
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPass(nova), u.id); res.json({ ok: true });
});

/* CRUD simples por tabela, sempre preso ao cliente logado */
const TABLES = {
  brands: { cols: ['name', 'sub', 'logo', 'sort'], order: 'sort,id' },
  categories: { cols: ['brand_id', 'name', 'icon', 'sort', 'active'], order: 'sort,id' },
  products: { cols: ['category_id', 'name', 'descr', 'price', 'promo_price', 'promo_days', 'promo_label', 'bulk_qty', 'bulk_price', 'img', 'icon', 'tag', 'options', 'keywords', 'active', 'sort'], order: 'sort,id', json: ['promo_days', 'options'] },
  stories: { cols: ['name', 'cover', 'slides', 'sort', 'active'], order: 'sort,id', json: ['slides'] },
  posts: { cols: ['img', 'product_id', 'caption', 'overlay', 'active', 'created_at'], order: 'created_at DESC' },
};
const clean = (tb, b) => { const d = TABLES[tb], o = {}; d.cols.forEach(c => { if (c in b) { let v = b[c]; if ((d.json || []).includes(c)) v = JSON.stringify(v ?? []); if (v === '') v = ['promo_price', 'bulk_qty', 'bulk_price', 'brand_id', 'category_id', 'product_id'].includes(c) ? null : v; if (typeof v === 'boolean') v = v ? 1 : 0; o[c] = v; } }); return o; };
const owns = (tb, id, tid) => !!db.prepare(`SELECT 1 FROM ${tb} WHERE id=? AND tenant_id=?`).get(id, tid);
function refsOk(o, tid) { for (const [c, tb] of [['brand_id', 'brands'], ['category_id', 'categories'], ['product_id', 'products']]) if (o[c] != null && !owns(tb, +o[c], tid)) return false; return true; }
for (const tb of Object.keys(TABLES)) {
  app.get(`/api/p/${tb}`, P, (req, res) => { const d = TABLES[tb]; res.json(db.prepare(`SELECT * FROM ${tb} WHERE tenant_id=? ORDER BY ${d.order}`).all(req.tid).map(r => { (d.json || []).forEach(c => r[c] = J(r[c], [])); return r; })); });
  app.post(`/api/p/${tb}`, P, (req, res) => { const o = clean(tb, req.body || {}); if (!refsOk(o, req.tid)) return res.status(400).json({ erro: 'Referência inválida' }); const ks = Object.keys(o); const r = db.prepare(`INSERT INTO ${tb}(tenant_id${ks.map(k => ',' + k).join('')}) VALUES(?${ks.map(() => ',?').join('')})`).run(req.tid, ...ks.map(k => o[k])); res.json({ id: r.lastInsertRowid }); });
  app.put(`/api/p/${tb}/:id`, P, (req, res) => { if (!owns(tb, +req.params.id, req.tid)) return res.status(404).end(); const o = clean(tb, req.body || {}); if (!refsOk(o, req.tid)) return res.status(400).json({ erro: 'Referência inválida' }); const ks = Object.keys(o); if (ks.length) db.prepare(`UPDATE ${tb} SET ${ks.map(k => k + '=?').join(',')} WHERE id=?`).run(...ks.map(k => o[k]), +req.params.id); res.json({ ok: true }); });
  app.delete(`/api/p/${tb}/:id`, P, (req, res) => { if (!owns(tb, +req.params.id, req.tid)) return res.status(404).end(); db.prepare(`DELETE FROM ${tb} WHERE id=?`).run(+req.params.id); res.json({ ok: true }); });
}

/* fotos: o navegador já manda a imagem reduzida em JPEG/PNG/WebP (data URL) */
app.post('/api/p/upload', P, (req, res) => {
  const m = String((req.body || {}).data || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/); if (!m) return res.status(400).json({ erro: 'Imagem inválida' });
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) return res.status(400).json({ erro: 'Imagem muito grande' });
  const dir = path.join(DATA_DIR, 'uploads', String(req.tid)); fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(dir, name), buf); res.json({ url: `/u/${req.tid}/${name}` });
});

/* pedidos */
function rangeOf(q) { const today = nowLocal().toISOString().slice(0, 10); const de = /^\d{4}-\d{2}-\d{2}$/.test(q.de) ? q.de : today, ate = /^\d{4}-\d{2}-\d{2}$/.test(q.ate) ? q.ate : today;
  const toUtc = (d, end) => new Date(new Date(d + (end ? 'T23:59:59.999Z' : 'T00:00:00.000Z')).getTime() - TZ * 36e5).toISOString(); return { de, ate, a: toUtc(de), b: toUtc(ate, true) }; }
const ST = ['pix', 'novo', 'preparando', 'saiu', 'concluido', 'cancelado'];
app.get('/api/p/orders', P, (req, res) => {
  const r = rangeOf(req.query), st = ST.includes(req.query.status) ? req.query.status : null;
  /* ativos=1: todos os pedidos em andamento (de qualquer dia) + os do período */
  const when = req.query.ativos ? `(status IN ('pix','novo','preparando','saiu') OR created_at BETWEEN ? AND ?)` : 'created_at BETWEEN ? AND ?';
  /* ordem = qual pedido do cliente é este (1 = cliente novo); cli_* = histórico do cliente pelo telefone */
  const rows = db.prepare(`SELECT o.*,
      (SELECT COUNT(*) FROM orders x WHERE x.tenant_id=o.tenant_id AND x.phone=o.phone AND x.status!='cancelado' AND x.id<=o.id) ordem,
      (SELECT COUNT(*) FROM orders x WHERE x.tenant_id=o.tenant_id AND x.phone=o.phone AND x.status!='cancelado') cli_pedidos,
      (SELECT COALESCE(SUM(total),0) FROM orders x WHERE x.tenant_id=o.tenant_id AND x.phone=o.phone AND x.status!='cancelado') cli_total,
      (SELECT MIN(created_at) FROM orders x WHERE x.tenant_id=o.tenant_id AND x.phone=o.phone) cli_desde
    FROM orders o WHERE o.tenant_id=? AND ${when.replace(/status|created_at/g, m => 'o.' + m)} ${st ? 'AND o.status=?' : ''} ORDER BY o.created_at DESC LIMIT 500`).all(req.tid, r.a, r.b, ...(st ? [st] : []));
  res.json(rows.map(o => ({ ...o, items: J(o.items, []), log: J(o.log, []), descontos: J(o.descontos, []) })));
});
app.get('/api/p/orders/novos', P, (req, res) => res.json(db.prepare(`SELECT COUNT(*) n, MAX(id) ultimo FROM orders WHERE tenant_id=? AND status IN ('novo','pix')`).get(req.tid)));
app.put('/api/p/orders/:id', P, (req, res) => {
  const st = (req.body || {}).status; if (!ST.includes(st)) return res.status(400).end();
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND tenant_id=?').get(+req.params.id, req.tid); if (!o) return res.status(404).end();
  const log = J(o.log, []); if (o.status !== st) log.push({ s: st, t: new Date().toISOString() });
  db.prepare('UPDATE orders SET status=?, log=? WHERE id=?').run(st, JSON.stringify(log), o.id);
  let ganhou = 0; if (o.status !== st) { try { ganhou = loyaltyOnStatus(req.tenant, o, st); } catch (e) { console.error('fidelidade', e.message); } }
  let msg = statusMessage(req.tenant, settingsOf(req.tenant), { ...o, status: st, prev: o.status }, req);
  if (msg && ganhou > 0) msg += `
🎁 Você ganhou ${brlS(ganhou)} de cashback para o próximo pedido!`;
  res.json({ ok: true, aviso: msg, whats: msg && o.phone ? waLink(o.phone, msg) : null });
});
/* acompanhamento do pedido pelo cliente (link secreto) */
app.get('/api/m/:slug/pedido/:track', (req, res) => {
  const t = tenantBySlug(req.params.slug); if (!t) return res.status(404).json({ erro: 'Loja não encontrada' });
  const o = db.prepare('SELECT * FROM orders WHERE tenant_id=? AND track=?').get(t.id, String(req.params.track)); if (!o) return res.status(404).json({ erro: 'Pedido não encontrado' });
  const s = settingsOf(t);
  res.json({ loja: { name: t.name, slug: t.slug, logo: s.logo, tema: s.tema, whatsapp: s.whatsapp || '', pixChave: s.pixChave, pixNome: s.pixNome, endereco: s.endereco, tempoPreparo: +s.tempoPreparo || 30, tempoEntrega: +s.tempoEntrega || 40 }, address: o.address, num: o.num, status: o.status, retirada: isPickup(o), created_at: o.created_at, log: J(o.log, []),
    items: J(o.items, []), descontos: J(o.descontos, []), km: o.km, subtotal: o.subtotal, discount: o.discount, fee: o.fee, total: o.total, payment: o.payment, bairro: o.bairro, customer: String(o.customer || '').split(' ')[0] });
});
app.get('/api/p/orders.csv', P, (req, res) => {
  const r = rangeOf(req.query), rows = db.prepare('SELECT * FROM orders WHERE tenant_id=? AND created_at BETWEEN ? AND ? ORDER BY created_at').all(req.tid, r.a, r.b);
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, n = v => String(v ?? 0).replace('.', ',');
  const csv = ['Pedido;Data;Hora;Status;Cliente;WhatsApp;Bairro;Endereço;Pagamento;Itens;Subtotal;Desconto;Entrega;Total',
    ...rows.map(o => { const d = new Date(new Date(o.created_at).getTime() + TZ * 36e5).toISOString(); return [o.num, d.slice(0, 10), d.slice(11, 16), o.status, q(o.customer), o.phone, q(o.bairro), q(o.address), o.payment, q(J(o.items, []).map(i => `${i.qty}x ${i.nome}${i.opts.length ? ' (' + i.opts.join(', ') + ')' : ''}`).join(' | ')), n(o.subtotal), n(o.discount), n(o.fee), n(o.total)].join(';'); })].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="vendas-${req.tenant.slug}-${r.de}-a-${r.ate}.csv"`); res.send('﻿' + csv);
});

/* cadastro de clientes + números dos pedidos (pelo WhatsApp) */
const phoneNorm = v => String(v || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 13);
function clientes(tid, id) {
  const now = Date.now();
  return db.prepare(`SELECT c.*, COUNT(o.id) pedidos, COALESCE(SUM(o.total),0) total, MIN(o.created_at) primeiro, MAX(o.created_at) ultimo
    FROM customers c LEFT JOIN orders o ON o.tenant_id=c.tenant_id AND o.phone=c.phone AND o.status!='cancelado'
    WHERE c.tenant_id=? ${id ? 'AND c.id=?' : ''} GROUP BY c.id ORDER BY COALESCE(MAX(o.created_at), c.created_at) DESC`).all(tid, ...(id ? [id] : [])).map(c => {
    const dias = c.ultimo ? Math.floor((now - new Date(c.ultimo)) / 864e5) : null;
    const seg = !c.pedidos ? 'cadastrado' : dias > 30 && c.pedidos > 1 ? 'sumido' : c.pedidos >= 5 ? 'fiel' : c.pedidos >= 2 ? 'recorrente' : 'novo';
    return { ...c, total: round2(c.total), ticket: c.pedidos ? round2(c.total / c.pedidos) : 0, dias, seg };
  });
}
/* chamado a cada pedido: cria ou atualiza a ficha */
function upsertCustomer(tid, o) {
  const c = db.prepare('SELECT * FROM customers WHERE tenant_id=? AND phone=?').get(tid, o.phone);
  if (!c) db.prepare('INSERT INTO customers(tenant_id,phone,name,address,bairro) VALUES(?,?,?,?,?)').run(tid, o.phone, o.name, o.address, o.bairro);
  else db.prepare('UPDATE customers SET name=COALESCE(NULLIF(name,\'\'),?), address=CASE WHEN ?!=\'\' THEN ? ELSE address END, bairro=CASE WHEN ?!=\'\' AND ?!=\'Retirada na loja\' THEN ? ELSE bairro END WHERE id=?')
    .run(o.name, o.address, o.address, o.bairro, o.bairro, o.bairro, c.id);
}
app.get('/api/p/clientes', P, (req, res) => res.json(clientes(req.tid)));
app.get('/api/p/clientes/:id', P, (req, res) => {
  const c = clientes(req.tid, +req.params.id)[0]; if (!c) return res.status(404).end();
  const pedidos = db.prepare('SELECT id,num,created_at,status,total,payment,bairro,items FROM orders WHERE tenant_id=? AND phone=? ORDER BY id DESC LIMIT 100').all(req.tid, c.phone).map(o => ({ ...o, items: J(o.items, []) }));
  const fav = {}; pedidos.filter(o => o.status !== 'cancelado').forEach(o => o.items.forEach(i => fav[i.nome] = (fav[i.nome] || 0) + i.qty));
  const F = settingsOf(req.tenant).fidelidade;
  res.json({ ...c, cashback: F.tipo === 'cashback' ? cashbackSaldo(req.tid, c.phone) : null, selos: F.tipo === 'selos' ? { ...selosInfo(req.tid, c.phone, F.selosMeta), meta: F.selosMeta } : null, historico: pedidos, favoritos: Object.entries(fav).sort((a, b) => b[1] - a[1]).slice(0, 5) });
});
const CUST = ['name', 'email', 'birthday', 'address', 'bairro', 'notes', 'tags'];
function custBody(b) { const o = {}; CUST.forEach(k => { if (k in b) o[k] = String(b[k] ?? '').trim().slice(0, k === 'notes' ? 500 : 160); }); if (o.birthday && !/^\d{4}-\d{2}-\d{2}$|^$/.test(o.birthday)) o.birthday = ''; return o; }
app.post('/api/p/clientes', P, (req, res) => {
  const b = req.body || {}, phone = phoneNorm(b.phone); if (phone.length < 10) return res.status(400).json({ erro: 'WhatsApp com DDD' });
  if (db.prepare('SELECT 1 FROM customers WHERE tenant_id=? AND phone=?').get(req.tid, phone)) return res.status(400).json({ erro: 'Já existe cliente com esse WhatsApp' });
  const o = custBody(b), ks = Object.keys(o);
  const r = db.prepare(`INSERT INTO customers(tenant_id,phone${ks.map(k => ',' + k).join('')}) VALUES(?,?${ks.map(() => ',?').join('')})`).run(req.tid, phone, ...ks.map(k => o[k]));
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/p/clientes/:id', P, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=? AND tenant_id=?').get(+req.params.id, req.tid); if (!c) return res.status(404).end();
  const o = custBody(req.body || {}), ks = Object.keys(o); if (ks.length) db.prepare(`UPDATE customers SET ${ks.map(k => k + '=?').join(',')} WHERE id=?`).run(...ks.map(k => o[k]), c.id);
  res.json({ ok: true });
});
app.delete('/api/p/clientes/:id', P, (req, res) => { db.prepare('DELETE FROM customers WHERE id=? AND tenant_id=?').run(+req.params.id, req.tid); res.json({ ok: true }); });
app.get('/api/p/clientes.csv', P, (req, res) => {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, n = v => String(v ?? 0).replace('.', ',');
  const SEG = { novo: 'Novo', recorrente: 'Recorrente', fiel: 'Fiel', sumido: 'Sumido' };
  SEG.cadastrado = 'Sem pedido';
  const csv = ['Nome;WhatsApp;E-mail;Aniversário;Grupo;Pedidos;Total gasto;Ticket médio;Primeiro pedido;Último pedido;Dias sem comprar;Bairro;Endereço;Etiquetas;Observações',
    ...clientes(req.tid).map(c => [q(c.name), c.phone, q(c.email), c.birthday ? c.birthday.split('-').reverse().join('/') : '', SEG[c.seg], c.pedidos, n(c.total), n(c.ticket), c.primeiro ? localDate(c.primeiro) : '', c.ultimo ? localDate(c.ultimo) : '', c.dias ?? '', q(c.bairro), q(c.address), q(c.tags), q(c.notes)].join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="clientes-${req.tenant.slug}.csv"`); res.send('﻿' + csv);
});

/* cupons */
const CUP = ['code', 'tipo', 'valor', 'minimo', 'inicio', 'fim', 'max_usos', 'por_cliente', 'primeira', 'ativo', 'descricao'];
function cupBody(b) {
  const o = {}; CUP.forEach(k => { if (k in b) o[k] = b[k]; });
  if ('code' in o) o.code = String(o.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  if ('tipo' in o && !['percent', 'valor', 'frete'].includes(o.tipo)) o.tipo = 'percent';
  ['valor', 'minimo'].forEach(k => { if (k in o) o[k] = Math.max(0, +o[k] || 0); });
  ['max_usos', 'por_cliente'].forEach(k => { if (k in o) o[k] = Math.max(0, +o[k] | 0); });
  ['primeira', 'ativo'].forEach(k => { if (k in o) o[k] = o[k] ? 1 : 0; });
  ['inicio', 'fim'].forEach(k => { if (k in o && !/^d{4}-d{2}-d{2}$/.test(o[k])) o[k] = ''; });
  if ('descricao' in o) o.descricao = String(o.descricao || '').slice(0, 120);
  return o;
}
app.get('/api/p/cupons', P, (req, res) => res.json(db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.tenant_id=c.tenant_id AND o.coupon=c.code AND o.status!='cancelado') usos,
  (SELECT COALESCE(SUM(json_extract(d.value,'$.valor')),0) FROM orders o, json_each(o.descontos) d WHERE o.tenant_id=c.tenant_id AND o.coupon=c.code AND o.status!='cancelado' AND json_extract(d.value,'$.tipo')='cupom') desconto_total,
  (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.tenant_id=c.tenant_id AND o.coupon=c.code AND o.status!='cancelado') vendas
  FROM coupons c WHERE tenant_id=? ORDER BY ativo DESC, id DESC`).all(req.tid)));
app.post('/api/p/cupons', P, (req, res) => {
  const o = cupBody(req.body || {}); if (!o.code) return res.status(400).json({ erro: 'Coloque o código do cupom' });
  if (db.prepare('SELECT 1 FROM coupons WHERE tenant_id=? AND code=?').get(req.tid, o.code)) return res.status(400).json({ erro: 'Já existe um cupom com esse código' });
  const ks = Object.keys(o); const r = db.prepare(`INSERT INTO coupons(tenant_id${ks.map(k => ',' + k).join('')}) VALUES(?${ks.map(() => ',?').join('')})`).run(req.tid, ...ks.map(k => o[k])); res.json({ id: r.lastInsertRowid });
});
app.put('/api/p/cupons/:id', P, (req, res) => {
  const c = db.prepare('SELECT * FROM coupons WHERE id=? AND tenant_id=?').get(+req.params.id, req.tid); if (!c) return res.status(404).end();
  const o = cupBody(req.body || {}); delete o.code; const ks = Object.keys(o); if (ks.length) db.prepare(`UPDATE coupons SET ${ks.map(k => k + '=?').join(',')} WHERE id=?`).run(...ks.map(k => o[k]), c.id); res.json({ ok: true });
});
app.delete('/api/p/cupons/:id', P, (req, res) => { db.prepare('DELETE FROM coupons WHERE id=? AND tenant_id=?').run(+req.params.id, req.tid); res.json({ ok: true }); });

/* localizar a loja no mapa pelo endereço (para a taxa por distância) */
app.post('/api/p/localizar', P, async (req, res) => {
  const b = req.body || {}, cep = String(b.cep || '').replace(/D/g, ''); let ci = cep ? await viaCep(cep) : null;
  const g = await locate({ cep, rua: b.rua || (ci && ci.logradouro), numero: b.numero, bairro: ci && ci.bairro, cidade: b.cidade || (ci && ci.localidade), uf: b.uf || (ci && ci.uf) });
  if (!g) return res.status(404).json({ erro: 'Não achei esse endereço no mapa. Confira ou coloque as coordenadas.' });
  res.json({ ...g, endereco: ci ? `${ci.logradouro}, ${ci.bairro}, ${ci.localidade}/${ci.uf}` : '' });
});

/* relatório */
app.get('/api/p/report', P, (req, res) => {
  const r = rangeOf(req.query);
  const orders = db.prepare(`SELECT * FROM orders WHERE tenant_id=? AND created_at BETWEEN ? AND ? AND status!='cancelado'`).all(req.tid, r.a, r.b);
  const evs = db.prepare('SELECT type, COUNT(*) n FROM events WHERE tenant_id=? AND created_at BETWEEN ? AND ? GROUP BY type').all(req.tid, r.a, r.b);
  const ev = Object.fromEntries(evs.map(e => [e.type, e.n]));
  const days = {}; for (let d = new Date(r.de + 'T00:00:00Z'); d <= new Date(r.ate + 'T00:00:00Z'); d = new Date(d.getTime() + 864e5)) days[d.toISOString().slice(0, 10)] = { pedidos: 0, total: 0 };
  const prods = {}, bairros = {}, pays = {}, horas = Array(24).fill(0);
  let total = 0;
  for (const o of orders) {
    total += o.total; const d = localDate(o.created_at); if (days[d]) { days[d].pedidos++; days[d].total += o.total; }
    horas[new Date(new Date(o.created_at).getTime() + TZ * 36e5).getUTCHours()]++;
    bairros[o.bairro] = (bairros[o.bairro] || 0) + 1; pays[o.payment] = (pays[o.payment] || 0) + o.total;
    for (const i of J(o.items, [])) { const k = i.nome; prods[k] = prods[k] || { nome: k, qtd: 0, total: 0 }; prods[k].qtd += i.qty; prods[k].total += i.total; }
  }
  const capi = db.prepare(`SELECT info, created_at FROM events WHERE tenant_id=? AND type='CAPI' ORDER BY id DESC LIMIT 20`).all(req.tid);
  /* clientes novos x que voltaram, no período */
  const firstOf = db.prepare(`SELECT MIN(id) id FROM orders WHERE tenant_id=? AND phone=? AND status!='cancelado'`);
  let novos = 0, voltaram = 0; const vistos = new Set();
  for (const o of orders) { if (vistos.has(o.phone)) continue; vistos.add(o.phone); const f = firstOf.get(req.tid, o.phone); if (f && orders.some(x => x.id === f.id)) novos++; else voltaram++; }
  const wk = weekKey(), topLikes = db.prepare('SELECT p.name, COUNT(*) n FROM likes l JOIN products p ON p.id=l.product_id WHERE l.tenant_id=? AND l.week=? GROUP BY l.product_id ORDER BY n DESC LIMIT 5').all(req.tid, wk);
  res.json({ de: r.de, ate: r.ate, pedidos: orders.length, total: round2(total), ticket: orders.length ? round2(total / orders.length) : 0,
    visitas: ev.PageView || 0, carrinhos: ev.AddToCart || 0, checkouts: ev.InitiateCheckout || 0, contatos: ev.Contact || 0,
    dias: Object.entries(days).map(([d, v]) => ({ d, ...v, total: round2(v.total) })), horas,
    produtos: Object.values(prods).sort((a, b) => b.total - a.total).slice(0, 10).map(p => ({ ...p, total: round2(p.total) })),
    bairros: Object.entries(bairros).sort((a, b) => b[1] - a[1]).slice(0, 8), pagamentos: Object.entries(pays).map(([k, v]) => [k, round2(v)]),
    curtidas: topLikes, capi, clientesNovos: novos, clientesVoltaram: voltaram });
});

/* ---------------- admin ---------------- */
const A = auth('admin');
app.get('/api/a/tenants', A, (req, res) => {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  res.json(db.prepare(`SELECT t.id,t.slug,t.name,t.status,t.created_at,
    (SELECT COUNT(*) FROM orders o WHERE o.tenant_id=t.id AND o.created_at>=? AND o.status!='cancelado') pedidos30,
    (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.tenant_id=t.id AND o.created_at>=? AND o.status!='cancelado') vendas30,
    (SELECT COUNT(*) FROM products p WHERE p.tenant_id=t.id) produtos,
    (SELECT GROUP_CONCAT(email, ', ') FROM users u WHERE u.tenant_id=t.id) logins
    FROM tenants t ORDER BY t.status, t.name`).all(since, since));
});
app.post('/api/a/tenants', A, (req, res) => {
  const { name, slug, email, senha } = req.body || {}; const sl = slugify(slug || name);
  if (!name || !sl) return res.status(400).json({ erro: 'Nome obrigatório' });
  if (RESERVED.has(sl) || tenantBySlug(sl)) return res.status(400).json({ erro: `O endereço /${sl} já está em uso` });
  const em = String(email || '').trim().toLowerCase();
  if (em && (!/^\S+@\S+\.\S+$/.test(em) || String(senha || '').length < 8)) return res.status(400).json({ erro: 'Login precisa de e-mail válido e senha com 8+ caracteres' });
  if (em && db.prepare('SELECT 1 FROM users WHERE email=?').get(em)) return res.status(400).json({ erro: 'Esse e-mail já tem login' });
  const r = db.prepare('INSERT INTO tenants(slug,name,settings) VALUES(?,?,?)').run(sl, String(name).slice(0, 80), JSON.stringify({}));
  if (em) db.prepare('INSERT INTO users(email,name,pass_hash,role,tenant_id) VALUES(?,?,?,?,?)').run(em, String(name), hashPass(senha), 'cliente', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid, slug: sl });
});
app.put('/api/a/tenants/:id', A, (req, res) => {
  const t = tenantById(+req.params.id); if (!t) return res.status(404).end(); const b = req.body || {};
  const sl = b.slug != null ? slugify(b.slug) : t.slug; if (!sl || RESERVED.has(sl) || (sl !== t.slug && tenantBySlug(sl))) return res.status(400).json({ erro: 'Endereço indisponível' });
  db.prepare('UPDATE tenants SET name=?, slug=?, status=? WHERE id=?').run(String(b.name || t.name).slice(0, 80), sl, ['ativo', 'pausado'].includes(b.status) ? b.status : t.status, t.id); res.json({ ok: true });
});
app.post('/api/a/tenants/:id/login', A, (req, res) => {
  const t = tenantById(+req.params.id); if (!t) return res.status(404).end();
  const em = String((req.body || {}).email || '').trim().toLowerCase(), senha = String((req.body || {}).senha || '');
  if (!/^\S+@\S+\.\S+$/.test(em) || senha.length < 8) return res.status(400).json({ erro: 'E-mail válido e senha com 8+ caracteres' });
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(em);
  if (u && u.tenant_id !== t.id) return res.status(400).json({ erro: 'Esse e-mail já é de outro cliente' });
  if (u) db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPass(senha), u.id), db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
  else db.prepare('INSERT INTO users(email,name,pass_hash,role,tenant_id) VALUES(?,?,?,?,?)').run(em, t.name, hashPass(senha), 'cliente', t.id);
  res.json({ ok: true, criado: !u });
});
/* backup: baixa uma cópia do banco (todos os clientes) */
app.get('/api/a/backup', A, (req, res) => {
  const f = path.join(require('os').tmpdir(), `huntix-${Date.now()}.db`); backupNow(f);
  res.download(f, `huntix-backup-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.db`, () => { try { fs.unlinkSync(f); } catch {} });
});
app.post('/api/a/act', A, (req, res) => { const id = req.body && req.body.id ? +req.body.id : null; if (id && !tenantById(id)) return res.status(404).end(); db.prepare('UPDATE sessions SET acting_tenant=? WHERE token=?').run(id, req.s.token); res.json({ ok: true }); });

/* ---------------- páginas e arquivos ---------------- */
const pub = path.join(__dirname, 'public');
app.use('/static', express.static(pub, { maxAge: PROD ? '1h' : 0 }));
app.use('/img', express.static(path.join(__dirname, 'img'), { maxAge: '7d' }));
app.use('/u', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d' }));
app.use('/prototipos', express.static(path.join(__dirname, 'prototipos')));
app.use('/pausados', express.static(path.join(__dirname, 'pausados')));
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(pub, 'login.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(pub, 'painel.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
app.get('/:slug/pedido/:track', (req, res, next) => { if (RESERVED.has(req.params.slug) || !tenantBySlug(req.params.slug)) return next(); res.sendFile(path.join(pub, 'pedido.html')); });
app.get('/:slug', (req, res, next) => { if (RESERVED.has(req.params.slug) || !tenantBySlug(req.params.slug)) return next(); res.sendFile(path.join(pub, 'menu.html')); });
app.use((req, res) => res.status(404).send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Não encontrado</title><body style="font-family:system-ui;padding:40px;text-align:center"><h1>Página não encontrada</h1><p>Confira o link do cardápio.</p></body>'));

/* ---------------- início ---------------- */
seed({ db, hashPass });
app.listen(PORT, '0.0.0.0', () => console.log(`Cardápios no ar em http://localhost:${PORT}`));
module.exports = { slugify };
