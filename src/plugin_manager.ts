
import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';

export interface Plugin {
    name: string;
    css?: string;
    js?: string;
}

export class PluginManager {
    private plugins: Plugin[] = [];

    constructor() {
        console.log('Plugin Manager Initialized');
    }

    // Load all plugins from a directory
    loadPluginsFromDir(dirPath: string) {
        if (!fs.existsSync(dirPath)) {
            console.log(`Plugin directory not found: ${dirPath}. Creating it.`);
            fs.mkdirSync(dirPath, { recursive: true });
            return;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                this.loadPlugin(path.join(dirPath, entry.name));
            }
        }
    }

    loadPlugin(pluginPath: string) {
        try {
            const manifestPath = path.join(pluginPath, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const plugin: Plugin = {
                    name: manifest.name || path.basename(pluginPath),
                };

                if (manifest.css) {
                    const cssPath = path.join(pluginPath, manifest.css);
                    if (fs.existsSync(cssPath)) {
                        plugin.css = fs.readFileSync(cssPath, 'utf-8');
                    }
                }

                if (manifest.js) {
                    const jsPath = path.join(pluginPath, manifest.js);
                    if (fs.existsSync(jsPath)) {
                        plugin.js = fs.readFileSync(jsPath, 'utf-8');
                    }
                }

                this.plugins.push(plugin);
                console.log(`Loaded plugin: ${plugin.name}`);
            }
        } catch (error) {
            console.error(`Failed to load plugin at ${pluginPath}:`, error);
        }
    }

    injectPlugins(window: BrowserWindow) {
        window.webContents.on('did-finish-load', () => {
            for (const plugin of this.plugins) {
                if (plugin.css) {
                    window.webContents.insertCSS(plugin.css);
                }
                if (plugin.js) {
                    window.webContents.executeJavaScript(plugin.js);
                }
            }
            console.log(`Injected ${this.plugins.length} plugins.`);
        });
    }
}
