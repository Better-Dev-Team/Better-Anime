
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('betterAnime', {
    // Placeholder for future APIs
    version: '1.0.0',
    searchAnime: (query: string) => ipcRenderer.invoke('mal-search', query),
    updateAnime: (token: string, animeId: number, numWatchedEpisodes: number) =>
        ipcRenderer.invoke('mal-update', { token, id: animeId, episode: numWatchedEpisodes }),

    // AniList API
    searchAniList: (query: string) => ipcRenderer.invoke('anilist-search', query),
    updateAniList: (token: string, id: number, episode: number) =>
        ipcRenderer.invoke('anilist-update', { token, id, episode }),
    loginAniList: (clientId: string, clientSecret: string) =>
        ipcRenderer.invoke('anilist-login', clientId, clientSecret),

    // Window Controls
    minimize: () => ipcRenderer.send('window-min'),
    maximize: () => ipcRenderer.send('window-max'),
    close: () => ipcRenderer.send('window-close'),
    loginMAL: (clientId: string) => ipcRenderer.invoke('mal-login', clientId),
});

// Monitor Title Changes for YaboStatus
let lastTitle = '';
setInterval(() => {
    if (document.title !== lastTitle) {
        lastTitle = document.title;
        ipcRenderer.send('update-title', lastTitle);
    }
}, 3000);

console.log('Better-Anime Preload Loaded');
