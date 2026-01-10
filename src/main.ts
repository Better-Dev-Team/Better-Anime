
import { app, BrowserWindow, session, ipcMain, shell } from 'electron';
import * as http from 'http';
import * as crypto from 'crypto';
import * as path from 'path';
import { PluginManager } from './plugin_manager';
import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch';

async function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'Better Anime',
        autoHideMenuBar: true,
        frame: false, // Custom Title Bar
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
    });

    // Window Control IPC
    ipcMain.on('window-min', () => mainWindow.minimize());
    ipcMain.on('window-max', () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });
    ipcMain.on('window-close', () => mainWindow.close());

    const pluginManager = new PluginManager();
    const pluginsPath = path.join(__dirname, '../plugins');
    pluginManager.loadPluginsFromDir(pluginsPath);
    pluginManager.injectPlugins(mainWindow);

    try {
        const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
        blocker.enableBlockingInSession(session.defaultSession);
        console.log('AdBlocker enabled!');
    } catch (error) {
        console.error('Failed to enable AdBlocker:', error);
    }

    mainWindow.loadURL('https://aniwatchtv.to/home');
    // --- AniList Handlers ---

    ipcMain.handle('anilist-login', async (event, clientId: string, clientSecret: string) => {
        try {
            const codePromise = startAuthServer();

            const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=http://localhost:6969/callback&response_type=code`;
            shell.openExternal(authUrl);

            const code = await codePromise;

            const response = await fetch('https://anilist.co/api/v2/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: 'http://localhost:6969/callback',
                    code: code,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(JSON.stringify(data));
            return data.access_token;
        } catch (error) {
            console.error('AniList Login Error:', error);
            throw error;
        }
    });

    ipcMain.handle('anilist-search', async (event, query: string) => {
        try {
            console.log(`[AniList Search] Query: "${query}"`);
            const gql = `
            query ($search: String) {
                Media (search: $search, type: ANIME) {
                    id
                    title {
                        romaji
                        english
                    }
                }
            }`;

            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query: gql, variables: { search: query } })
            });

            const data = await response.json();
            if (data.data?.Media) {
                console.log(`[AniList Search] Found: ${data.data.Media.title.romaji} (${data.data.Media.id})`);
            } else {
                console.log(`[AniList Search] Not found.`);
            }
            return data.data?.Media;
        } catch (err) {
            console.error('[AniList Search] Error:', err);
            return null;
        }
    });

    ipcMain.handle('anilist-update', async (event, { token, id, episode }) => {
        try {
            console.log(`[AniList Update] Updating ID: ${id} to Ep: ${episode}`);
            const mutation = `
            mutation ($mediaId: Int, $progress: Int) {
                SaveMediaListEntry (mediaId: $mediaId, progress: $progress) {
                    id
                    progress
                }
            }`;

            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ query: mutation, variables: { mediaId: id, progress: episode } })
            });

            const data = await response.json();
            if (data.errors) {
                console.error(`[AniList Update] Error:`, data.errors);
                throw new Error(data.errors[0].message);
            }
            console.log(`[AniList Update] Success!`);
            return data.data?.SaveMediaListEntry;
        } catch (err) {
            console.error('[AniList Update] Error:', err);
            throw err;
        }
    });

    // --- End AniList Handlers ---
    // Block new windows (popups), but allow MAL
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('myanimelist.net')) {
            return { action: 'allow' };
        }
        console.log(`Blocked popup: ${url}`);
        return { action: 'deny' };
    });

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
}

app.on('ready', () => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// IPC Handlers for MAL Plugin
ipcMain.handle('mal-search', async (event, query) => {
    try {
        console.log(`[MAL Search] Query: "${query}"`);
        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const anime = data.data[0];
            console.log(`[MAL Search] Found: ${anime.title} (ID: ${anime.mal_id})`);
            return anime;
        } else {
            console.log(`[MAL Search] No results found for "${query}"`);
            return null;
        }
    } catch (error) {
        console.error('MAL Search Error:', error);
        return null;
    }
});

ipcMain.handle('mal-update', async (event, { token, id, episode }) => {
    try {
        console.log(`[MAL Update] Updating ID: ${id} to Ep: ${episode}`);
        const response = await fetch(`https://api.myanimelist.net/v2/anime/${id}/my_list_status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `num_watched_episodes=${episode}`
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`[MAL Update] Failed: ${response.status} - ${err}`);
            throw new Error(`MAL API Error: ${err}`);
        }
        return await response.json();
    } catch (error) {
        console.error('MAL Update Error:', error);
        throw error;
    }
});


// Helper for PKCE
function base64URLEncode(str: Buffer) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function sha256(buffer: Buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

// Global variable to track the server instance
let loginServer: http.Server | null = null;

// Shared Auth Server Helper
let authServer: http.Server | null = null;

function startAuthServer(): Promise<string> {
    // Close existing
    if (authServer) {
        authServer.close();
        authServer = null;
    }

    return new Promise((resolve, reject) => {
        authServer = http.createServer((req, res) => {
            try {
                // Determine if it's a callback
                const u = new URL(req.url || '', 'http://localhost:6969');
                if (u.pathname === '/callback') {
                    const code = u.searchParams.get('code');
                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h1>Login Successful!</h1><p>You can close this window now.</p><script>window.close()</script>');
                        resolve(code);
                    } else {
                        res.writeHead(400);
                        res.end('No code found.');
                        reject(new Error('No code found in callback'));
                    }
                } else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            } catch (e) {
                reject(e);
            } finally {
                // Close server soon after
                setTimeout(() => {
                    if (authServer) {
                        authServer.close();
                        authServer = null;
                    }
                }, 1000);
            }
        });

        authServer.listen(6969, () => {
            console.log('Auth Server listening on 6969');
        });

        authServer.on('error', (err) => {
            reject(err);
        });

        // Timeout
        setTimeout(() => {
            if (authServer) {
                authServer.close();
                authServer = null;
                reject(new Error('Auth Timeout (60s)'));
            }
        }, 60000);
    });
}

// Updated MAL Login Handler
ipcMain.handle('mal-login', async (event, clientId) => {
    try {
        const verifier = base64URLEncode(crypto.randomBytes(32));
        const codePromise = startAuthServer(); // Start server

        // Construct formatting
        const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&code_challenge=${verifier}&code_challenge_method=plain`;

        // Wait a tick ensures server is theoretically binding, but real robustness implies waiting for 'listening'. 
        // For simplicity in this env, we assume it binds fast.
        // Better: startAuthServer calls back?
        // Let's just openExternal.
        shell.openExternal(authUrl);

        const code = await codePromise;

        // Exchange
        const params = new URLSearchParams();
        params.append('client_id', clientId);
        params.append('code', code);
        params.append('code_verifier', verifier);
        params.append('grant_type', 'authorization_code');

        const tokenResponse = await fetch('https://myanimelist.net/v1/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.access_token) return tokenData.access_token;
        throw new Error('Failed to get access token');

    } catch (err) {
        console.error('MAL Login Error', err);
        throw err;
    }
});

// Update AniList Login to use new flow cleanly
// We need to re-handle the AniList logic above since we changed the startAuthServer sig
// I'll ensure the `anilist-login` handler I replaced above matches this pattern.
// In the replacement above:
// `const code = await startAuthServer();` -> This BLOCKS until code is found. The `shell.openExternal` never runs!
// I must run `startAuthServer` WITHOUT awaiting it immediately, OR run openExternal inside it?
// Or my previous logic: `startAuthServer` returns a Promise, I store it, then I open URL, then I await it.
// See `mal-login` implementation in this chunk:
// `const codePromise = startAuthServer(); shell.openExternal...; const code = await codePromise;`
// This is correct.

// So, for `anilist-login` (which is in the FIRST replacement chunk), I need to correct it to:
// const codePromise = startAuthServer();
// shell.openExternal(...);
// const code = await codePromise;


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
