#!/usr/bin/env node
/**
 * PitCrew Desktop (Electron shell).
 *
 * Responsibilities stay presentation-only (AGENTS.md package boundaries):
 * - own the Mission Control window and tray;
 * - own the daemon child lifecycle, reusing the same packaged daemon entry
 *   the CLI uses;
 * - inject the session token into the URL fragment so nobody copies tokens.
 *
 * The shell runs no missions and mutates no mission state. It expects the
 * PitCrew CLI runtime (Node 22.13+) to be installed; the daemon entry is
 * resolved from PITCREW_DAEMON, the PitCrew install root, or the workspace.
 */
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  shell,
  nativeImage,
} from 'electron';
import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let window = null;
let tray = null;
let daemon = null;
let quitting = false;

function pitcrewHome() {
  return resolve(process.env.PITCREW_HOME ?? join(homedir(), '.pitcrew'));
}

function configPath() {
  return process.env.PITCREW_CONFIG ?? join(pitcrewHome(), 'config.json');
}

function statePath() {
  return process.env.PITCREW_STATE ?? join(pitcrewHome(), 'state');
}

function daemonEntry() {
  const override = process.env.PITCREW_DAEMON;
  if (override && existsSync(override)) return resolve(override);
  const candidates = [
    // Packaged install layout: <installRoot>/dist/daemon.js
    resolve(
      process.env.PITCREW_INSTALL_ROOT ?? join(homedir(), 'PitCrew'),
      'dist',
      'daemon.js',
    ),
    // Packaged app resources
    resolve(process.resourcesPath ?? '', 'pitcrew', 'dist', 'daemon.js'),
    // Workspace development
    resolve(dirname, '..', '..', 'daemon', 'dist', 'main.js'),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function refereeMissingMessage() {
  return (
    'PitCrew needs its runtime. Install the CLI runtime first:\n\n' +
    '  1. Install Node.js 22.13 or newer\n' +
    '  2. Run the PitCrew installer (install.ps1 / install.sh) or\n' +
    '     npm install -g @pitcrew/cli\n' +
    '  3. Run "pitcrew setup" once to create the configuration\n\n' +
    'Expected configuration: ' +
    configPath()
  );
}

function firstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && existsSync(join(candidate, 'index.html')))
      return candidate;
  }
  return null;
}

function startDaemon() {
  const entry = daemonEntry();
  if (!entry) throw new Error('PitCrew daemon runtime not found.');
  if (!existsSync(configPath())) throw new Error(refereeMissingMessage());
  const child = fork(entry, [configPath(), statePath()], {
    execArgv: ['--experimental-sqlite'],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: {
      ...process.env,
      // Run the Electron binary as plain Node for the daemon child.
      ELECTRON_RUN_AS_NODE: '1',
      // UI assets live in real files (asar is not readable from an
      // ELECTRON_RUN_AS_NODE child): prefer the staged runtime, then the
      // workspace build.
      PITCREW_UI_ROOT:
        firstExisting([
          resolve(process.resourcesPath ?? '', 'pitcrew', 'dist', 'desktop'),
          join(dirname, '..', 'dist'),
        ]) ?? process.env.PITCREW_UI_ROOT,
    },
  });
  child.stderr?.on('data', (chunk) => {
    if (process.env.PITCREW_DEBUG) console.error(String(chunk));
  });
  return child;
}

function readyMessage() {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Daemon startup timed out.')),
      20000,
    );
    const onMessage = (value) => {
      if (value && value.type === 'ready') {
        clearTimeout(timer);
        resolvePromise(value);
      }
    };
    const onExit = () => {
      clearTimeout(timer);
      reject(new Error('Daemon exited during startup.'));
    };
    daemon.once('message', onMessage);
    daemon.once('exit', onExit);
  });
}

function createWindow(url) {
  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'PitCrew',
    backgroundColor: '#101014',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.on('closed', () => {
    window = null;
  });
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    // External links open in the user's browser, never in the app shell.
    if (!target.startsWith(url.split('#')[0])) {
      void shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  void window.loadURL(url);
}

function showWindow() {
  if (window) {
    window.show();
    window.focus();
    return;
  }
  // Recreate against the last known URL (token stays in the fragment).
  createWindow(lastUrl);
}

let lastUrl = null;
let trayMenu = null;

function setupTray() {
  const icon = nativeImage.createFromPath(resolve(dirname, 'tray.png'));
  if (icon.isEmpty()) return; // Tray is optional; the window is the product.
  tray = new Tray(icon);
  trayMenu = Menu.buildFromTemplate([
    { label: 'Open PitCrew', click: showWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(trayMenu);
  tray.setToolTip('PitCrew — local-first AI engineering crew');
}

function handleDaemonExit(code) {
  daemon = null;
  if (quitting) return;
  void dialog.showMessageBox({
    type: 'error',
    title: 'PitCrew daemon stopped',
    message:
      'The PitCrew daemon stopped (exit code ' +
      code +
      ').\n' +
      'Reopen the app to restart it. Check "pitcrew doctor" for details.',
  });
}

app.on('second-instance', showWindow);
app.whenReady().then(async () => {
  try {
    daemon = startDaemon();
    daemon.on('exit', handleDaemonExit);
    const ready = await readyMessage();
    lastUrl = ready.url + '/#token=' + ready.token;
    createWindow(lastUrl);
    setupTray();
  } catch (error) {
    void dialog.showMessageBox({
      type: 'error',
      title: 'PitCrew could not start',
      message: error instanceof Error ? error.message : String(error),
      detail: refereeMissingMessage(),
    });
    app.quit();
  }
  app.on('activate', showWindow);
});
app.on('before-quit', () => {
  quitting = true;
});
app.on('window-all-closed', () => {
  // Keep the tray daemon running on Windows; quit only when quitting.
  if (quitting || !tray) app.quit();
});
process.on('exit', () => {
  if (daemon && daemon.connected) daemon.disconnect();
});
