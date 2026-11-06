const { app, BrowserWindow, screen, Tray, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const logFile = path.join(app.getPath('userData'), 'widget.log');
function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

log('--- Widget process started ---');

process.on('uncaughtException', (err) => {
  log('Uncaught Exception: ' + (err.stack || err));
});
process.on('unhandledRejection', (reason) => {
  log('Unhandled Rejection: ' + (reason ? reason.stack || reason : 'unknown'));
});

let mainWindow = null;
let tray = null;
let server = null;
let serverPort = null;
let activeCharmId = 'spider';
let updateTrayMenu = () => {};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function getOutDir() {
  const candidates = [
    path.join(__dirname, '..', 'out'),
    path.join(app.getAppPath(), 'out'),
    path.join(process.resourcesPath, 'out'),
    path.join(process.resourcesPath, 'app.asar', 'out'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) {
        return dir;
      }
    } catch (e) {}
  }
  return path.join(__dirname, '..', 'out');
}

// Embedded local HTTP server for Next.js static export
function startLocalServer(baseDir) {
  return new Promise((resolve, reject) => {
    log('Starting local server with baseDir: ' + baseDir);
    const srv = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/widget.html';

      let filePath = path.join(baseDir, reqPath);
      let targetFile = null;

      try {
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            targetFile = filePath;
          } else if (stat.isDirectory()) {
            if (fs.existsSync(filePath + '.html') && fs.statSync(filePath + '.html').isFile()) {
              targetFile = filePath + '.html';
            } else if (fs.existsSync(path.join(filePath, 'index.html')) && fs.statSync(path.join(filePath, 'index.html')).isFile()) {
              targetFile = path.join(filePath, 'index.html');
            }
          }
        } else if (fs.existsSync(filePath + '.html') && fs.statSync(filePath + '.html').isFile()) {
          targetFile = filePath + '.html';
        }
      } catch (err) {
        log('Error checking path ' + filePath + ': ' + err.message);
      }

      if (!targetFile) {
        log(`404 Not Found: ${req.url} (resolved: ${filePath})`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(targetFile).pipe(res);
    });

    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      log('Local server listening on port ' + port);
      resolve({ server: srv, port });
    });

    srv.on('error', (err) => {
      log('Server error: ' + err.message);
      reject(err);
    });
  });
}

async function createWidgetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  log(`Creating full-screen transparent overlay (${width}x${height}, x: 0, y: 0)`);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  const targetUrl = `http://127.0.0.1:${serverPort}/widget.html`;
  log('Loading target URL: ' + targetUrl);
  await mainWindow.loadURL(targetUrl);

  log('Window loaded successfully, displaying showInactive()');
  mainWindow.showInactive();

  mainWindow.on('closed', () => {
    log('Window closed event');
    mainWindow = null;
  });

  mainWindow.on('hide', () => {
    mainWindow?.webContents.send('widget:visibility', false);
  });

  mainWindow.on('show', () => {
    mainWindow?.webContents.send('widget:visibility', true);
  });
}

function sendCharmToWindow(charmId) {
  activeCharmId = charmId;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('widget:set-charm', charmId);
  }
  updateTrayMenu();
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  log('Creating tray with icon: ' + iconPath);
  tray = new Tray(iconPath);
  tray.setToolTip('3D Hanging Charm Overlay');

  updateTrayMenu = () => {
    const isStartupEnabled = app.getLoginItemSettings().openAtLogin;
    const isVisible = mainWindow && mainWindow.isVisible();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? 'Hide Charm' : 'Show Charm',
        click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
          }
          updateTrayMenu();
        },
      },
      {
        label: 'Select Charm',
        submenu: [
          {
            label: '🕷️ Golden Spider',
            type: 'radio',
            checked: activeCharmId === 'spider',
            click: () => sendCharmToWindow('spider'),
          },
          {
            label: '🦇 Dark Knight Batman',
            type: 'radio',
            checked: activeCharmId === 'batman',
            click: () => sendCharmToWindow('batman'),
          },
          {
            label: '⚡ Iron Man Arc Reactor',
            type: 'radio',
            checked: activeCharmId === 'ironman',
            click: () => sendCharmToWindow('ironman'),
          },
          {
            label: '💎 Superman Shield',
            type: 'radio',
            checked: activeCharmId === 'superman',
            click: () => sendCharmToWindow('superman'),
          },
          {
            label: '⭐ Vibranium Shield',
            type: 'radio',
            checked: activeCharmId === 'shield',
            click: () => sendCharmToWindow('shield'),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: isStartupEnabled,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
            path: process.execPath,
          });
          updateTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    updateTrayMenu();
  });

  updateTrayMenu();
}

function registerIpcHandlers() {
  ipcMain.on('widget:close', () => {
    log('IPC: widget:close');
    app.quit();
  });

  ipcMain.on('widget:hide', () => {
    log('IPC: widget:hide');
    if (mainWindow) {
      mainWindow.hide();
    }
  });

  ipcMain.on('widget:set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options || { forward: true });
    }
  });

  ipcMain.on('widget:active-charm-changed', (_event, charmId) => {
    activeCharmId = charmId;
    updateTrayMenu();
  });

  ipcMain.handle('widget:get-startup', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('widget:set-startup', (_event, enable) => {
    app.setLoginItemSettings({
      openAtLogin: !!enable,
      path: process.execPath,
    });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('widget:open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Custom Charm Image',
      filters: [
        { name: 'Images', extensions: ['png', 'svg', 'jpg', 'jpeg', 'webp', 'gif'] },
      ],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      const base64Data = data.toString('base64');
      const fileName = path.basename(filePath, path.extname(filePath));
      return {
        name: fileName,
        dataUrl: `data:${mime};base64,${base64Data}`,
      };
    }
    return null;
  });
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('Another instance already running, quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Second instance attempted, bringing window to front.');
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const outDir = getOutDir();
      log('Resolved outDir: ' + outDir);

      const srvResult = await startLocalServer(outDir);
      server = srvResult.server;
      serverPort = srvResult.port;

      registerIpcHandlers();
      await createWidgetWindow();
      createTray();
    } catch (err) {
      log('Failed to initialize desktop widget: ' + (err.stack || err));
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    if (server) {
      server.close();
    }
  });
}
