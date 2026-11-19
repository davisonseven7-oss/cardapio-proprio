/* Gera icon.png (512x512) a partir da marca Huntix (mira laranja no fundo preto). Rodar: npm run icone */
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512"><rect width="64" height="64" rx="14" fill="#111111"/><g fill="none" stroke="#F26A21" stroke-width="4.5" stroke-linecap="round"><path d="M32 10v8M32 46v8M10 32h8M46 32h8"/><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="8" stroke="#FFFFFF"/></g><circle cx="32" cy="32" r="3.2" fill="#F26A21"/></svg>`;
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${SVG}</body></html>`));
  await new Promise(r => setTimeout(r, 400));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(path.join(__dirname, 'icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
  console.log('icon.png gerado'); app.quit();
});
