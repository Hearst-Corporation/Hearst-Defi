import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
// CommonJS-friendly imports (tsc → dist-electron uses --module CommonJS output).
// electron-updater is loaded LAZILY inside app.whenReady() because its
// top-level instantiation calls app.getVersion() before Electron's `app` is
// initialized otherwise.
// electron-store@11 is ESM-only — incompatible with our CJS bundle — so we
// roll a tiny JSON-file state instead (zero deps, zero gnarly require()).
import path from "node:path";
import fs from "node:fs";

interface AppState {
  env: "local" | "prod";
}

const STATE_DEFAULTS: AppState = { env: "local" };

function statePath(): string {
  return path.join(app.getPath("userData"), "state.json");
}

function readState(): AppState {
  try {
    const raw = fs.readFileSync(statePath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...STATE_DEFAULTS, ...parsed };
  } catch {
    return STATE_DEFAULTS;
  }
}

function writeState(next: Partial<AppState>): void {
  const merged = { ...readState(), ...next };
  try {
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(merged), "utf-8");
  } catch {
    /* best-effort persistence; not fatal */
  }
}

const ENV_URLS: Record<"local" | "prod", string> = {
  local: "http://localhost:4105",
  // Production = deployed Vercel app (verified custom domain). Overridable at
  // build time via HEARST_APP_URL; falls back to the canonical prod domain.
  prod: process.env.HEARST_APP_URL ?? "https://connect.hearst.app",
};

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 360,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const splashPath = app.isPackaged
    ? path.join(process.resourcesPath, "splash.html")
    : path.join(__dirname, "..", "electron", "splash.html");
  splashWindow.loadFile(splashPath);
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function createMainWindow(env: "local" | "prod"): void {
  writeState({ env });
  const url = ENV_URLS[env];

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  // In dev (env=local), nuke caches so HMR / new routes always show fresh.
  // In prod, the production app handles caching at the HTTP layer.
  if (env === "local") {
    mainWindow.webContents.session.clearCache();
    mainWindow.webContents.session.clearStorageData({
      storages: ["cachestorage", "serviceworkers", "shadercache"],
    });
  }

  mainWindow.loadURL(url);

  // Open external links in the user's default browser. Only http(s) — never
  // file:// nor custom schemes (would allow open-redirect from a compromised
  // page).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch {
      /* invalid URL — drop */
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        // Env picker is dev-only — distributed builds always run against prod.
        ...(app.isPackaged
          ? []
          : [
              {
                label: "Switch environment…",
                click: () => {
                  mainWindow?.close();
                  createSplash();
                },
              } as const,
            ]),
        {
          label: "Force reload (clear cache)",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => {
            mainWindow?.webContents.session.clearCache().then(() => {
              mainWindow?.webContents.reloadIgnoringCache();
            });
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      label: "Help",
      submenu: [
        {
          label: "Hearst Connect — github.com/Hearst-Corporation/Hearst-Defi",
          click: () => shell.openExternal("https://github.com/Hearst-Corporation/Hearst-Defi"),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle("select-env", (_event, env: "local" | "prod") => {
  splashWindow?.close();
  createMainWindow(env);
});

ipcMain.handle("get-last-env", () => readState().env);

app.whenReady().then(() => {
  if (app.isPackaged) {
    // Distributed build: no local/prod picker — go straight to production.
    // The env selector splash is a dev-only convenience.
    createMainWindow("prod");
    // Lazy-load electron-updater AFTER app is ready (its constructor calls
    // app.getVersion()).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on("update-downloaded", () => {
      autoUpdater.quitAndInstall();
    });
  } else {
    createSplash();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (app.isPackaged) createMainWindow("prod");
    else createSplash();
  }
});
