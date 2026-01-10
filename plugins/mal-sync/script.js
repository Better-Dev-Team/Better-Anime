
console.log('MAL Sync Plugin Loaded');

class MalSync {
    constructor() {
        this.token = localStorage.getItem('mal_access_token');
        this.currentAnime = null;
        this.currentEpisode = null;
        this.initUI();
        this.startTracking();
    }


    initUI() {
        this.waitForSettings();
    }

    waitForSettings() {
        // Wait for Settings API to be available
        const check = setInterval(() => {
            if (window.BetterAnimeSettings) {
                clearInterval(check);
                this.registerSettings();
            }
        }, 100);
    }

    registerSettings() {
        window.BetterAnimeSettings.registerPlugin('MAL Sync', (container) => {
            this.renderSettings(container);
        });
    }

    renderSettings(container) {
        container.innerHTML = `
            <h3>MAL Sync Configuration</h3>
            <p style="color:#aaa; font-size:12px; margin-bottom:15px;">
                Status: <span id="mal-settings-status" style="color: ${this.token ? 'lightgreen' : '#ff5555'}">
                ${this.token ? 'Authenticated' : 'Not Logged In'}
                </span>
            </p>

            ${!this.token ? `
                <div class="ba-input-group">
                    <label>Client ID</label>
                    <input type="text" id="mal-client-id" placeholder="Paste Client ID here" value="${localStorage.getItem('mal_client_id') || ''}">
                    <div style="font-size: 11px; margin-top: 5px; color: #888;">
                        <a href="https://myanimelist.net/apiconfig" target="_blank" style="color: #6688dd;">Get Client ID</a>
                         (Redirect URL: http://localhost:6969/callback)
                    </div>
                </div>
                <button id="mal-login-btn" class="ba-btn">Login with MAL</button>
            ` : `
                <div style="margin-bottom: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px;">
                     <div><strong>Logged in</strong></div>
                     <div style="font-size: 12px; color: #aaa; margin-top:5px;">Your token is saved securely.</div>
                </div>
                <button id="mal-logout-btn" class="ba-btn ba-btn-secondary">Logout</button>
            `}
        `;

        this.attachListeners(container);
    }

    attachListeners(container) {
        // Login Button
        const loginBtn = container.querySelector('#mal-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const clientIdInput = container.querySelector('#mal-client-id');
                const clientId = clientIdInput?.value?.trim();

                if (!clientId) {
                    alert('Please enter a Client ID!');
                    return;
                }

                localStorage.setItem('mal_client_id', clientId);
                loginBtn.textContent = 'Logging in...';

                try {
                    if (window.betterAnime) {
                        const token = await window.betterAnime.loginMAL(clientId);
                        if (token) {
                            localStorage.setItem('mal_access_token', token);
                            this.token = token;
                            // Re-render the settings container
                            this.renderSettings(container);
                            alert('Login Successful!');
                        }
                    }
                } catch (err) {
                    console.error('Login Failed', err);
                    alert('Login Failed: ' + err.message);
                    loginBtn.textContent = 'Login with MAL';
                }
            });
        }

        // Logout Button
        const logoutBtn = container.querySelector('#mal-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('mal_access_token');
                    this.token = null;
                    this.renderSettings(container);
                }
            });
        }
    }

    startTracking() {
        // Poll for changes
        setInterval(() => {
            this.detectState();
        }, 5000);
    }

    async detectState() {
        try {
            let title = null;
            let episode = null;

            // Method 1: Specific Selectors (AniWatch)
            const titleEl = document.querySelector('.film-name.dynamic-name') || document.querySelector('.anisc-detail .film-name');
            const episodeEl = document.querySelector('.ssl-item.ep-item.active') || document.querySelector('.ep-item.active');

            if (titleEl) title = titleEl.textContent?.trim();
            if (episodeEl) episode = parseInt(episodeEl.getAttribute('data-number') || episodeEl.textContent?.trim() || '0', 10);

            // Method 2: Fallback to document.title
            if (!title || !episode) {
                const docTitle = document.title;
                const match = docTitle.match(/Watch (.+?) Episode (\d+)/);
                if (match) {
                    if (!title) title = match[1].trim();
                    if (!episode) episode = parseInt(match[2], 10);
                }
            }

            // Logic: Only update if changed
            if (title !== this.currentAnime || episode !== this.currentEpisode) {
                this.currentAnime = title;
                this.currentEpisode = episode;

                if (this.currentAnime && this.currentEpisode && this.token) {
                    console.log(`[MAL Sync] Detected ${title} Ep ${episode}. Updating...`);
                    await this.handleUpdate(this.currentAnime, this.currentEpisode);
                } else {
                    console.log(`[MAL Sync] Detected ${title} Ep ${episode}. (Token: ${!!this.token})`);
                }
            }
        } catch (e) {
            console.error('[MAL Sync] Error in detection:', e);
        }
    }

    async handleUpdate(title, episode) {
        if (!window.betterAnime) return;

        console.log(`[MAL Sync] handleUpdate called for: "${title}" Ep: ${episode} (${typeof episode})`);

        try {
            // 1. Search for Anime ID
            const anime = await window.betterAnime.searchAnime(title);
            console.log('[MAL Sync] Search Result:', anime);

            if (!anime) {
                console.log(`[MAL Sync] Anime not found.`);
                return;
            }

            console.log(`[MAL Sync] Found: ${anime.title} (ID: ${anime.mal_id}). Updating to Ep ${episode}...`);

            // 2. Update MAL
            await window.betterAnime.updateAnime(this.token, anime.mal_id, episode);
            console.log(`[MAL Sync] Success! Updated ${anime.title} to Ep ${episode}`);

        } catch (error) {
            console.error('[MAL Sync] Update Failed:', error);
        }
    }

    updateUI(status) {
        // Deprecated: No UI to update on main screen
        // potentially log to debug or update settings UI if open?
    }
}

new MalSync();
