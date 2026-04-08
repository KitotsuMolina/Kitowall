import {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, net, protocol} from 'electron';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createBackend, runTrayAction} from './backend.mjs';

let mainWindow;
let tray;
let backend;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveAppIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'app.asar', 'src', 'assets', 'kitowall-icon.png'),
        path.join(process.resourcesPath, 'src', 'assets', 'kitowall-icon.png'),
        path.join(process.resourcesPath, 'kitowall-icon.png')
      ]
    : [
        path.join(__dirname, '..', 'src', 'assets', 'kitowall-icon.png')
      ];

  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) return {path: candidate, image};
  }

  return {path: candidates[0], image: nativeImage.createEmpty()};
}

function registerLocalAssetProtocol() {
  protocol.handle('kitowall-file', request => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname || '');
    return net.fetch(pathToFileURL(pathname).toString());
  });
}

async function createWindow() {
  const {path: appIconPath} = resolveAppIconPath();
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    show: false,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  backend = await createBackend(mainWindow);
  ipcMain.handle('kitowall:invoke', async (_event, command, args) => {
    return await backend.invoke(command, args ?? {});
  });

  mainWindow.on('close', event => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL('http://127.0.0.1:1420');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (!/^(1|true|yes)$/i.test(process.env.KITOWALL_START_MINIMIZED ?? '')) {
      mainWindow.show();
    }
  });
}

function createTray() {
  const {path: iconPath, image} = resolveAppIconPath();
  if (image.isEmpty()) {
    console.error(`[kitowall-ui] tray icon not found: ${iconPath}`);
    return;
  }
  tray = new Tray(image);
  const menu = Menu.buildFromTemplate([
    {label: 'Open Kitowall', click: () => { mainWindow.show(); }},
    {type: 'separator'},
    {label: 'Rotate Now', click: () => { void runTrayAction('rotate-now'); }},
    {label: 'Live Wallpapers: Start', click: () => { void runTrayAction('live-start'); }},
    {label: 'Live Wallpapers: Restart', click: () => { void runTrayAction('live-restart'); }},
    {label: 'Live Wallpapers: Stop', click: () => { void runTrayAction('live-stop'); }},
    {type: 'separator'},
    {label: 'Quit', click: () => { app.isQuiting = true; app.quit(); }}
  ]);
  tray.setToolTip('Kitowall');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  registerLocalAssetProtocol();
  await createWindow();
  createTray();
});

app.on('window-all-closed', event => {
  event.preventDefault();
});
