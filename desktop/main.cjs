const { app, BrowserWindow, session } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('Gothere');
// Keep the same profile across package upgrades. Tests use an isolated Chromium profile.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'Gothere'));
}
const gameURL = pathToFileURL(join(__dirname, 'index.html')).href;
// Automated smoke tests must never show a window or take the player's focus.
const hiddenTest = app.commandLine.hasSwitch('gothere-test-hidden');
let window;

app.whenReady().then(() => {
  const current = session.defaultSession;
  current.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  current.setPermissionCheckHandler(() => false);
  current.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.split('#')[0];
    callback({ cancel: url !== gameURL && !url.startsWith('data:') && !url.startsWith('blob:') });
  });
  window = new BrowserWindow({
    width: 1440, height: 1040, minWidth: 900, minHeight: 640,
    title: '一定要到达那里', backgroundColor: '#f6f7ec', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false, devTools: false, spellcheck: false,
      backgroundThrottling: !hiddenTest },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== gameURL) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault(); window.setFullScreen(!window.isFullScreen());
    }
  });
  window.once('ready-to-show', () => { if (!hiddenTest) window.show(); });
  window.on('closed', () => { window = null; });
  window.loadURL(gameURL);
}).catch(error => { console.error('Unable to open Gothere:', error.message); app.exit(1); });

app.on('window-all-closed', () => app.quit());
