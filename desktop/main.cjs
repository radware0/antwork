const { app, BrowserWindow, dialog, ipcMain, Menu, net, powerMonitor, protocol, session, shell, Tray } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { assetPath, DesktopLifecycle } = require('./runtime.cjs');
const testProfile = process.env.ANTWORK_TEST_USER_DATA_DIR;
app.setName('antwork');
app.setPath('userData', testProfile ? path.resolve(testProfile) : path.join(app.getPath('appData'), 'antwork'));

if (require('electron-squirrel-startup')) {
  app.quit();
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  start();
}

function start() {
  app.setAppUserModelId('com.squirrel.antwork.antwork');
  protocol.registerSchemesAsPrivileged([{ scheme: 'antwork', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
  let mainWindow;
  let documentationWindow;
  let timerWindow;
  let tray;
  let countdownTimeout;
  let lifecycle;
  let allowClose = false;
  let closeTimer;
  const icon = path.join(__dirname, 'icon.ico');
  const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'";

  function trustedSender(event) {
    if (![mainWindow, timerWindow].some(window => window && !window.isDestroyed() && event.sender === window.webContents) || event.senderFrame !== event.sender.mainFrame) return false;
    try {
      const url = new URL(event.senderFrame.url);
      return url.protocol === 'antwork:' && url.host === 'app' && (url.pathname === '/' || url.pathname === '/index.html');
    } catch { return false; }
  }

  function openExternal(address) {
    try {
      const url = new URL(address);
      if (url.protocol === 'http:' || url.protocol === 'https:') void shell.openExternal(url.href).catch(() => {});
    } catch { /* Reject invalid or non-web links. */ }
  }

  function openDocumentation(address) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!documentationWindow || documentationWindow.isDestroyed()) {
      documentationWindow = new BrowserWindow({ width: 1000, height: 800, icon, show: !testProfile, autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
      documentationWindow.removeMenu(); secureWindow(documentationWindow, true);
      documentationWindow.once('closed', () => { documentationWindow = null; });
    }
    void documentationWindow.loadURL(address).catch(error => console.error('Could not open documentation:', error.message));
    if (!testProfile) { documentationWindow.show(); documentationWindow.focus(); }
  }

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed() || closeTimer) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
  }

  function openTimerWindow() {
    if (!mainWindow || mainWindow.isDestroyed() || closeTimer) return;
    if (!timerWindow || timerWindow.isDestroyed()) {
      timerWindow = new BrowserWindow({
        width: 640, height: 400, minWidth: 280, minHeight: 200, title: 'antwork timer', icon,
        frame: false, resizable: true, movable: true, thickFrame: true,
        show: !testProfile, autoHideMenuBar: true,
        webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
      });
      timerWindow.removeMenu(); secureWindow(timerWindow);
      timerWindow.once('closed', () => { timerWindow = null; });
      void timerWindow.loadURL('antwork://app/index.html?timer=popout').catch(error => console.error('Could not open timer:', error.message));
    }
    if (!testProfile) { if (timerWindow.isMinimized()) timerWindow.restore(); timerWindow.show(); timerWindow.focus(); }
  }

  function secureWindow(window, isDocumentation = false) {
    if (!isDocumentation) {
      const visibility = () => window.webContents.send('antwork:visibility-changed', window.isVisible() && !window.isMinimized());
      for (const event of ['show', 'hide', 'minimize', 'restore']) window.on(event, visibility);
      for (const event of ['maximize', 'unmaximize']) window.on(event, () => window.webContents.send('antwork:window-maximized', window.isMaximized()));
    }
    window.webContents.setWindowOpenHandler(({ url }) => {
      openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, address) => {
      try {
        const url = new URL(address);
        if (url.protocol === 'antwork:' && url.host === 'app') {
          if (url.pathname.startsWith('/docs/')) {
            if (isDocumentation) return;
            event.preventDefault(); setImmediate(() => openDocumentation(url.href)); return;
          }
          if (!isDocumentation && (url.pathname === '/' || url.pathname === '/index.html')) return;
          event.preventDefault();
          mainWindow?.show(); mainWindow?.focus();
          return;
        }
      } catch { /* Block invalid navigation. */ }
      event.preventDefault();
      openExternal(address);
    });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
  }

  function requestPause(reason, at) {
    clearTimeout(countdownTimeout);
    lifecycle.pause(reason, at);
    for (const window of [mainWindow, timerWindow]) {
      if (window && !window.isDestroyed()) window.webContents.send('antwork:pause-requested');
    }
  }

  app.on('second-instance', showMainWindow);
  app.on('activate', showMainWindow);
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => { lifecycle?.stopHeartbeat(); clearTimeout(closeTimer); clearTimeout(countdownTimeout); tray?.destroy(); });

  app.whenReady().then(async () => {
    lifecycle = new DesktopLifecycle(path.join(app.getPath('userData'), 'timer-checkpoint.json'));
    const root = path.join(app.getAppPath(), 'app-dist');
    protocol.handle('antwork', async request => {
      try {
        if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
        let file = assetPath(root, request.url);
        if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        const response = await net.fetch(pathToFileURL(file).href);
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', csp);
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(response.body, { status: response.status, headers });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (_event, item, contents) => {
      if (contents !== mainWindow?.webContents) { item.cancel(); return; }
      const filename = path.basename(item.getFilename());
      const destination = process.env.ANTWORK_TEST_DOWNLOAD_DIR
        ? path.join(process.env.ANTWORK_TEST_DOWNLOAD_DIR, filename)
        : dialog.showSaveDialogSync(mainWindow, { title: 'Export antwork backup', defaultPath: path.join(app.getPath('documents'), filename), filters: [{ name: 'JSON backup', extensions: ['json'] }] });
      if (destination) item.setSavePath(destination); else item.cancel();
    });
    mainWindow = new BrowserWindow({
      width: 1280, height: 900, minWidth: 500, minHeight: 600, title: 'antwork', icon,
      frame: false, resizable: true, movable: true, thickFrame: true,
      show: !testProfile, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    mainWindow.removeMenu();
    secureWindow(mainWindow);
    tray = new Tray(icon);
    tray.setToolTip('antwork');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open antwork', click: showMainWindow },
      { label: 'Open timer', click: openTimerWindow },
      { type: 'separator' },
      { label: 'Quit antwork', click: () => mainWindow.close() },
    ]));
    tray.on('click', showMainWindow);
    mainWindow.on('minimize', () => mainWindow.hide());
    ipcMain.on('antwork:open-docs', event => { if (trustedSender(event)) openDocumentation('antwork://app/docs/'); });
    ipcMain.handle('antwork:window-visible', event => {
      if (!trustedSender(event)) return false;
      const window = BrowserWindow.fromWebContents(event.sender);
      return window.isVisible() && !window.isMinimized();
    });
    ipcMain.on('antwork:open-timer', event => {
      if (trustedSender(event)) openTimerWindow();
    });
    ipcMain.on('antwork:window-control', (event, action) => {
      if (!trustedSender(event) || !['minimize', 'toggle-maximize', 'close'].includes(action)) return;
      const window = BrowserWindow.fromWebContents(event.sender);
      if (action === 'minimize') window.minimize();
      else if (action === 'close') window.close();
      else if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    });
    ipcMain.handle('antwork:window-maximized', event => trustedSender(event) && BrowserWindow.fromWebContents(event.sender).isMaximized());
    ipcMain.handle('antwork:get-pause', event => trustedSender(event) ? lifecycle.pending : null);
    ipcMain.handle('antwork:acknowledge-pause', (event, id) => {
      if (!trustedSender(event) || typeof id !== 'string' || !lifecycle.acknowledge(id)) return false;
      if (closeTimer) {
        clearTimeout(closeTimer); closeTimer = null; allowClose = true;
        setImmediate(() => { for (const window of BrowserWindow.getAllWindows()) window.close(); });
      }
      return true;
    });
    ipcMain.on('antwork:timer-state', (event, runningSince, deadline) => {
      // The main window owns the recovery heartbeat; the pop-out shares its saved timer.
      if (!mainWindow || mainWindow.isDestroyed() || closeTimer || allowClose) return;
      if (trustedSender(event) && event.sender === mainWindow.webContents && (runningSince === null || Number.isFinite(runningSince)) && (deadline === null || (Number.isSafeInteger(deadline) && deadline > 0))) {
        clearTimeout(countdownTimeout);
        try {
          lifecycle.reportTimer(runningSince);
          if (runningSince !== null && deadline !== null && !lifecycle.pending) {
            // One native wake-up keeps countdowns timely while hidden renderers are throttled.
            countdownTimeout = setTimeout(() => {
              if (!mainWindow.isDestroyed()) mainWindow.webContents.send('antwork:timer-due');
            }, Math.min(2147483647, Math.max(0, deadline - Date.now())));
          }
        }
        catch { console.error('Could not save the timer recovery checkpoint.'); }
      }
    });
    mainWindow.on('close', event => {
      if (allowClose) return;
      event.preventDefault();
      if (closeTimer) return;
      try { requestPause('close'); }
      catch {
        dialog.showErrorBox('Could not save timer state', 'The app stayed open. Export your history and try closing again.');
        return;
      }
      closeTimer = setTimeout(() => {
        // The checkpoint preserves the pause even if the renderer stops responding.
        allowClose = true;
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      }, 5000);
    });
    mainWindow.webContents.on('render-process-gone', () => {
      try { requestPause('recovery', lifecycle.lastSeenAt ?? 0); }
      catch { console.error('Could not save the interrupted timer checkpoint.'); }
    });
    const pauseForSleep = () => {
      try { requestPause('sleep'); }
      catch { console.error('Could not save the sleep checkpoint.'); }
    };
    powerMonitor.on('suspend', pauseForSleep);
    mainWindow.on('query-session-end', pauseForSleep);
    await mainWindow.loadURL('antwork://app/index.html');
  }).catch(error => {
    console.error('Could not start antwork:', error.message);
    if (!testProfile) dialog.showErrorBox('Could not start antwork', 'The desktop app could not load. Your saved history has not been removed.');
    app.exit(1);
  });
}
