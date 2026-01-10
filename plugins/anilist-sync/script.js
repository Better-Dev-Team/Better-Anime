console.log('AniList Sync Plugin Loaded');

class AniListSync {
    constructor() {
        this.token = localStorage.getItem('anilist_access_token');
        this.currentAnime = null;
        this.currentEpisode = null;

        // Wait for Settings API
        this.waitForSettings();

        // Start tracking
        this.startTracking();
    }

    waitForSettings() {
        const check = setInterval(() => {
            if (window.BetterAnimeSettings) {
                clearInterval(check);
                this.registerSettings();
            }
        }, 100);
    }

    registerSettings() {
        window.BetterAnimeSettings.registerPlugin('AniList', (container) => {
            this.renderSettings(container);
        });
    }

    renderSettings(container) {
        container.innerHTML = `
            <h3>AniList Configuration</h3>
            <p style="color:#aaa; font-size:12px; margin-bottom:15px;">
                Status: <span style="color: ${this.token ? 'lightgreen' : '#ff5555'}">
                ${this.token ? 'Authenticated' : 'Not Logged In'}
                </span>
            </p>

            ${!this.token ? `
                <div class="ba-input-group">
                    <label>Client ID</label>
                    <input type="text" id="al-client-id" placeholder="Client ID" value="${localStorage.getItem('al_client_id') || ''}">
                </div>
                <div class="ba-input-group">
                    <label>Client Secret</label>
                    <input type="password" id="al-client-secret" placeholder="Client Secret" value="${localStorage.getItem('al_client_secret') || ''}">
                     <div style="font-size: 11px; margin-top: 5px; color: #888;">
                        <a href="https://anilist.co/settings/developer" target="_blank" style="color: #6688dd;">Get Credentials</a>
                        (Redirect URI: http://localhost:6969/callback)
                    </div>
                </div>
                <button id="al-login-btn" class="ba-btn">Login with AniList</button>
            ` : `
                <div style="margin-bottom: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
                     <div><strong>Logged in</strong></div>
                     <div style="font-size: 12px; color: #aaa; margin-top:5px;">Your token is saved securely.</div>
                </div>
                <button id="al-logout-btn" class="ba-btn ba-btn-secondary">Logout</button>
            `}
        `;

        this.attachListeners(container);
    }

    attachListeners(container) {
        const loginBtn = container.querySelector('#al-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const clientId = container.querySelector('#al-client-id').value.trim();
                const clientSecret = container.querySelector('#al-client-secret').value.trim();

                if (!clientId || !clientSecret) {
                    alert('Please enter Client ID and Secret!');
                    return;
                }

                localStorage.setItem('al_client_id', clientId);
                localStorage.setItem('al_client_secret', clientSecret);
                loginBtn.textContent = 'Logging in...';

                try {
                    if (window.betterAnime) {
                        const token = await window.betterAnime.loginAniList(clientId, clientSecret);
                        if (token) {
                            localStorage.setItem('anilist_access_token', token);
                            this.token = token;
                            this.renderSettings(container);
                            alert('AniList Login Successful!');
                        }
                    }
                } catch (err) {
                    console.error('AniList Login Failed', err);
                    alert('Login Failed: ' + err.message);
                    loginBtn.textContent = 'Login with AniList';
                }
            });
        }

        const logoutBtn = container.querySelector('#al-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Logout from AniList?')) {
                    localStorage.removeItem('anilist_access_token');
                    this.token = null;
                    this.renderSettings(container);
                }
            });
        }
    }

    startTracking() {
        setInterval(() => this.detectState(), 5000);
    }

    async detectState() {
        // Reuse robust detection from MAL Sync
        let title = document.title;
        let episode = null;

        // AniWatch specific
        const titleEl = document.querySelector('.film-name.dynamic-name') || document.querySelector('.anisc-detail .film-name');
        const episodeEl = document.querySelector('.ssl-item.ep-item.active') || document.querySelector('.ep-item.active');

        if (titleEl) title = titleEl.textContent.trim();
        if (episodeEl) {
            const epText = episodeEl.getAttribute('data-number') || episodeEl.textContent.trim();
            if (epText) episode = parseInt(epText, 10);
        }

        // Cleanup Title
        title = title.replace(/Episode \d+.*$/, '').replace('Watch', '').trim();

        if (title && episode && (title !== this.currentAnime || episode !== this.currentEpisode)) {
            console.log(`Detected: ${title} - Ep ${episode}`);
            this.currentAnime = title;
            this.currentEpisode = episode;

            if (this.token) {
                await this.syncToAniList(title, episode);
            }
        }
    }

    async syncToAniList(title, episode) {
        try {
            console.log(`[AniList Sync] Syncing: "${title}" Ep: ${episode}`);
            // 1. Search
            const anime = await window.betterAnime.searchAniList(title);
            console.log('[AniList Sync] Search Result:', anime);

            if (anime && anime.id) {
                console.log(`[AniList Sync] Found ID: ${anime.id} (${anime.title.romaji})`);

                // 2. Update
                const result = await window.betterAnime.updateAniList(this.token, anime.id, episode);
                console.log(`[AniList Sync] Updated:`, result);

                // Optional: Show notification
            } else {
                console.warn('[AniList Sync] Anime not found:', title);
            }
        } catch (err) {
            console.error('[AniList Sync] Error:', err);
        }
    }
}

new AniListSync();
