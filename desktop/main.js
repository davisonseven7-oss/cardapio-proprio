/* Huntix Pedidos · app para o computador da loja
   - abre o painel da loja numa janela própria (fica logado)
   - imprime direto na impressora escolhida, sem janela de confirmação
   - avisa pedido novo com notificação do Windows, mesmo minimizado
   - fica na bandeja (perto do relógio) e inicia junto com o Windows */
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SERVIDOR = process.env.HUNTIX_URL || 'https://huntixdelivery.up.railway.app';
const CFG_FILE = () => path.join(app.getPath('userData'), 'config.json');
const cfg = (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE(), 'utf8')); } catch { return {}; } })();
const salvar = () => { try { fs.writeFileSync(CFG_FILE(), JSON.stringify(cfg, null, 2)); } catch {} };
const ICON = path.join(__dirname, 'icon.png');

let win = null, tray = null, saindo = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => mostrar());
app.setAppUserModelId('br.com.huntermarketing.huntix');

function mostrar() { if (!win) return criarJanela(); if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function criarJanela() {
  win = new BrowserWindow({
    width: 1300, height: 860, minWidth: 900, minHeight: 600, title: 'Huntix Pedidos', icon: ICON, autoHideMenuBar: true,
    show: !process.argv.includes('--oculto'), backgroundColor: '#F6F6F8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false, partition: 'persist:huntix' }
  });
  win.loadURL(SERVIDOR + '/painel');
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain) win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="font-family:system-ui;padding:40px;text-align:center"><h2>Sem conexão com o Huntix</h2><p>Confira a internet. Tentando de novo em 10 segundos…</p></body>`)); setTimeout(() => win && win.loadURL(SERVIDOR + '/painel'), 10000); });
  /* links de fora (WhatsApp, mapa) abrem no navegador do computador */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
    if (url.startsWith(SERVIDOR) && !/\/api\//.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICON } };
    shell.openExternal(url); return { action: 'deny' };
  });
  /* o painel abre uma janela em branco e depois manda para o WhatsApp: leva para o navegador */
  win.webContents.on('did-create-window', child => {
    child.webContents.on('did-start-navigation', (e) => { const u = e.url || ''; if (u && u !== 'about:blank' && !u.startsWith(SERVIDOR)) { shell.openExternal(u); setTimeout(() => !child.isDestroyed() && child.close(), 50); } });
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(SERVIDOR)) { e.preventDefault(); shell.openExternal(url); } });
  win.on('close', e => {
    if (saindo) return; e.preventDefault(); win.hide();
    if (!cfg.avisouBandeja) { cfg.avisouBandeja = true; salvar(); new Notification({ title: 'Huntix Pedidos continua aberto', body: 'Ele fica perto do relógio e avisa quando chegar pedido. Para fechar de vez, clique com o botão direito no ícone e em Sair.', icon: ICON }).show(); }
  });
}

/* impressão silenciosa: monta a comanda numa janela invisível e manda direto para a impressora */
function imprimir(html) {
  return new Promise(resolve => {
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    w.webContents.once('did-finish-load', () => {
      w.webContents.print({ silent: true, printBackground: true, deviceName: cfg.impressora || '', margins: { marginType: 'none' } }, (ok, motivo) => {
        resolve(ok ? { ok: true } : { ok: false, erro: motivo || 'falhou' }); setTimeout(() => !w.isDestroyed() && w.close(), 500);
      });
    });
    setTimeout(() => { if (!w.isDestroyed()) { w.close(); resolve({ ok: false, erro: 'tempo esgotado' }); } }, 20000);
  });
}

ipcMain.handle('hx:print', async (e, html) => typeof html === 'string' && html.length < 500000 ? imprimir(html) : { ok: false, erro: 'comanda inválida' });
ipcMain.handle('hx:printers', async () => { const ps = await win.webContents.getPrintersAsync(); return { atual: cfg.impressora || '', lista: ps.map(p => ({ nome: p.name, padrao: !!p.isDefault })) }; });
ipcMain.handle('hx:setPrinter', async (e, nome) => { cfg.impressora = String(nome || ''); salvar(); montarBandeja(); return { ok: true }; });
ipcMain.handle('hx:info', async () => ({ versao: app.getVersion(), impressora: cfg.impressora || '', servidor: SERVIDOR }));
ipcMain.on('hx:notify', (e, t, b) => {
  const n = new Notification({ title: String(t || 'Huntix').slice(0, 80), body: String(b || '').slice(0, 200), icon: ICON }); n.on('click', mostrar); n.show();
  if (win && !win.isFocused()) win.flashFrame(true);
});

async function montarBandeja() {
  if (!tray) { tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 })); tray.setToolTip('Huntix Pedidos'); tray.on('click', mostrar); }
  let ps = []; try { ps = win ? await win.webContents.getPrintersAsync() : []; } catch {}
  const inicia = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir painel', click: mostrar },
    { label: 'Impressora de pedidos', submenu: [{ label: 'Padrão do Windows', type: 'radio', checked: !cfg.impressora, click: () => { cfg.impressora = ''; salvar(); } },
      ...ps.map(p => ({ label: p.name, type: 'radio', checked: cfg.impressora === p.name, click: () => { cfg.impressora = p.name; salvar(); } }))] },
    { label: 'Iniciar com o Windows', type: 'checkbox', checked: inicia, click: m => app.setLoginItemSettings({ openAtLogin: m.checked, args: ['--oculto'] }) },
    { type: 'separator' },
    { label: 'Sobre', click: () => dialog.showMessageBox({ type: 'info', title: 'Huntix Pedidos', message: `Huntix Pedidos ${app.getVersion()}`, detail: `Um sistema Hunter Marketing.\n${SERVIDOR}` }) },
    { label: 'Sair', click: () => { saindo = true; app.quit(); } }
  ]));
}

app.whenReady().then(() => {
  if (cfg.primeiraVez !== false) { app.setLoginItemSettings({ openAtLogin: true, args: ['--oculto'] }); cfg.primeiraVez = false; salvar(); }
  criarJanela(); montarBandeja();
});
app.on('before-quit', () => { saindo = true; });
app.on('window-all-closed', e => e.preventDefault());
