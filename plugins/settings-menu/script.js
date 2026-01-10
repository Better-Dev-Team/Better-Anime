
console.log('Settings Menu Plugin Loaded');

class SettingsMenu {
    constructor() {
        this.plugins = [];
        this.initUI();
        this.exposeAPI();
    }

    exposeAPI() {
        // Expose API for other plugins to register tabs
        window.BetterAnimeSettings = {
            registerPlugin: (name, renderCallback) => {
                this.plugins.push({ name, render: renderCallback });
                this.updateSidebar();
                console.log(`Plugin registered in Settings: ${name}`);
            }
        };
    }

    initUI() {
        // Create full Title Bar
        const titleBar = document.createElement('div');
        titleBar.id = 'ba-titlebar';
        titleBar.innerHTML = `
            <div id="ba-titlebar-left">
                <button id="ba-nav-back" title="Back">
                    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
                <button id="ba-nav-forward" title="Forward">
                     <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                </button>
                <button id="ba-nav-refresh" title="Refresh">
                    <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-0.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14 0.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                </button>
            </div>

            <div id="ba-titlebar-center">
                 <!-- Empty drag region -->
            </div>

            <div id="ba-titlebar-right">
                <!-- Settings Gear inside Title Bar -->
                <button id="ba-titlebar-settings" title="Settings">
                    <svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
                </button>
                <div class="ba-separator"></div>
                <button class="ba-window-ctrl" id="ba-win-min" title="Minimize">
                    <svg viewBox="0 0 10 1"><path d="M0 0h10v1H0z"/></svg>
                </button>
                <button class="ba-window-ctrl" id="ba-win-max" title="Maximize">
                     <svg viewBox="0 0 10 10"><path d="M0 0h10v10H0V0zm1 1v8h8V1H1z"/></svg>
                </button>
                <button class="ba-window-ctrl ba-close" id="ba-win-close" title="Close">
                     <!-- Actual X Icon -->
                     <svg viewBox="0 0 10 10"><polygon points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5"/></svg>
                </button>
            </div>
        `;
        document.body.prepend(titleBar);

        // Push body content down - Updated for 40px height
        document.body.style.marginTop = '40px';
        document.body.style.height = 'calc(100vh - 40px)';

        // Create Modal (Same as before)
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'ba-settings-modal-overlay';
        modalOverlay.innerHTML = `
            <div id="ba-settings-modal">
                <div id="ba-settings-header">
                    <h2>Better Anime Settings</h2>
                    <button id="ba-settings-close">&times;</button>
                </div>
                <div id="ba-settings-body">
                    <div id="ba-settings-sidebar"></div>
                    <div id="ba-settings-content">
                        <!-- Content injected here -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        this.attachListeners(titleBar, modalOverlay);
    }

    attachListeners(titleBar, modalOverlay) {
        // Settings Toggle
        const gear = titleBar.querySelector('#ba-titlebar-settings');
        gear.addEventListener('click', () => this.openModal());

        // Modal Close
        const closeBtn = modalOverlay.querySelector('#ba-settings-close');
        closeBtn.addEventListener('click', () => this.closeModal());
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) this.closeModal();
        });

        // Navigation
        titleBar.querySelector('#ba-nav-back').addEventListener('click', () => window.history.back());
        titleBar.querySelector('#ba-nav-forward').addEventListener('click', () => window.history.forward());
        titleBar.querySelector('#ba-nav-refresh').addEventListener('click', () => window.location.reload());

        // Window Controls
        if (window.betterAnime) {
            titleBar.querySelector('#ba-win-min').addEventListener('click', () => window.betterAnime.minimize());
            titleBar.querySelector('#ba-win-max').addEventListener('click', () => window.betterAnime.maximize());
            titleBar.querySelector('#ba-win-close').addEventListener('click', () => window.betterAnime.close());
        }
    }


    openModal() {
        document.getElementById('ba-settings-modal-overlay').classList.add('visible');
        // Select first tab by default if none selected
        const firstTab = document.querySelector('.ba-settings-tab-btn');
        if (firstTab && !document.querySelector('.ba-settings-tab-btn.active')) {
            firstTab.click();
        }
    }

    closeModal() {
        document.getElementById('ba-settings-modal-overlay').classList.remove('visible');
    }

    updateSidebar() {
        const sidebar = document.getElementById('ba-settings-sidebar');
        const content = document.getElementById('ba-settings-content');

        // Clear current (simple re-render for now)
        sidebar.innerHTML = '';
        content.innerHTML = '';

        this.plugins.forEach((plugin, index) => {
            // Create Tab
            const btn = document.createElement('button');
            btn.className = 'ba-settings-tab-btn';
            btn.textContent = plugin.name;
            btn.dataset.index = index;
            btn.addEventListener('click', () => this.switchTab(index));
            sidebar.appendChild(btn);

            // Create Content Section
            const section = document.createElement('div');
            section.className = 'ba-settings-section';
            section.id = `ba-settings-section-${index}`;
            // Let the plugin render its content
            plugin.render(section);
            content.appendChild(section);
        });

        // Restore active tab if it exists, else 0
        const activeIdx = this.currentTabIndex || 0;
        this.switchTab(activeIdx);
    }

    switchTab(index) {
        this.currentTabIndex = index;
        document.querySelectorAll('.ba-settings-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ba-settings-section').forEach(s => s.classList.remove('active'));

        const btn = document.querySelectorAll('.ba-settings-tab-btn')[index];
        const section = document.getElementById(`ba-settings-section-${index}`);

        if (btn && section) {
            btn.classList.add('active');
            section.classList.add('active');
        }
    }
}

new SettingsMenu();
