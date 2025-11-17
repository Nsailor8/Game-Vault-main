// Global Settings Manager - Runs on all pages
(function() {
    'use strict';
    
    // Global settings object
    window.GameVaultSettings = {
        settings: {
            theme: 'light',
            fontSize: 'medium',
            language: 'en',
            dateFormat: 'mm/dd/yyyy',
            emailNotifications: false,
            friendRequests: true,
            gameUpdates: true,
            profileVisibility: 'public',
            showActivity: true
        },
        
        // Load settings from localStorage
        loadSettings() {
            const saved = localStorage.getItem('gameVaultSettings');
            if (saved) {
                try {
                    this.settings = { ...this.settings, ...JSON.parse(saved) };
                } catch (e) {
                    console.error('Error loading settings:', e);
                }
            }
        },
        
        // Apply theme
        applyTheme() {
            const root = document.documentElement;
            const body = document.body;
            
            // Remove existing theme classes
            body.classList.remove('theme-light', 'theme-dark');
            
            let theme = this.settings.theme;
            
            // Handle auto theme
            if (theme === 'auto') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                theme = prefersDark ? 'dark' : 'light';
            }
            
            // Apply theme
            body.classList.add(`theme-${theme}`);
            root.setAttribute('data-theme', theme);
        },
        
        // Apply font size
        applyFontSize() {
            const root = document.documentElement;
            const fontSizeMap = {
                small: '14px',
                medium: '16px',
                large: '18px',
                xlarge: '20px'
            };
            
            root.style.fontSize = fontSizeMap[this.settings.fontSize] || fontSizeMap.medium;
        },
        
        // Apply all settings
        applySettings() {
            this.applyTheme();
            this.applyFontSize();
        },
        
        // Save settings to localStorage
        saveSettings(settings) {
            if (settings) {
                this.settings = { ...this.settings, ...settings };
            }
            localStorage.setItem('gameVaultSettings', JSON.stringify(this.settings));
            this.applySettings();
            
            // Sync to server if user is logged in
            this.syncToServer();
        },
        
        // Sync settings to server
        async syncToServer() {
            try {
                const response = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(this.settings)
                });
                
                if (!response.ok) {
                    console.error('Failed to sync settings to server');
                }
            } catch (error) {
                // Silently fail if user is not logged in
                if (error.message && !error.message.includes('401')) {
                    console.error('Error syncing settings:', error);
                }
            }
        },
        
        // Initialize - called on page load
        init() {
            this.loadSettings();
            this.applySettings();
            
            // Listen for system theme changes when auto theme is selected
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addEventListener('change', (e) => {
                    if (this.settings.theme === 'auto') {
                        this.applyTheme();
                    }
                });
            }
            
            // Listen for storage changes (when settings are changed in another tab)
            window.addEventListener('storage', (e) => {
                if (e.key === 'gameVaultSettings') {
                    this.loadSettings();
                    this.applySettings();
                }
            });
        }
    };
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.GameVaultSettings.init();
        });
    } else {
        window.GameVaultSettings.init();
    }
    
    // Also apply immediately (before DOM ready) for theme
    window.GameVaultSettings.loadSettings();
    if (window.GameVaultSettings.settings.theme) {
        let theme = window.GameVaultSettings.settings.theme;
        if (theme === 'auto' && window.matchMedia) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            theme = prefersDark ? 'dark' : 'light';
        }
        if (document.documentElement) {
            document.documentElement.setAttribute('data-theme', theme);
        }
        if (document.body) {
            document.body.classList.add(`theme-${theme}`);
        }
    }
    
    if (window.GameVaultSettings.settings.fontSize) {
        const fontSizeMap = {
            small: '14px',
            medium: '16px',
            large: '18px',
            xlarge: '20px'
        };
        if (document.documentElement) {
            document.documentElement.style.fontSize = fontSizeMap[window.GameVaultSettings.settings.fontSize] || fontSizeMap.medium;
        }
    }
})();
