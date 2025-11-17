// Settings Management
class SettingsManager {
    constructor() {
        this.settings = {
            theme: 'light',
            fontSize: 'medium',
            language: 'en',
            dateFormat: 'mm/dd/yyyy',
            emailNotifications: false,
            friendRequests: true,
            gameUpdates: true,
            profileVisibility: 'public',
            showActivity: true
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.applySettings();
    }

    loadSettings() {
        // Load from localStorage
        const saved = localStorage.getItem('gameVaultSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('gameVaultSettings', JSON.stringify(this.settings));
        
        // Update global settings manager if available
        if (window.GameVaultSettings) {
            window.GameVaultSettings.saveSettings(this.settings);
        } else {
            // Also save to server if user is logged in
            this.syncToServer();
        }
    }

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
            console.error('Error syncing settings:', error);
        }
    }

    setupEventListeners() {
        // Theme selector
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = this.settings.theme;
            themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.applyTheme();
                this.saveSettings();
            });
        }

        // Font size selector
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
            fontSizeSelect.value = this.settings.fontSize;
            fontSizeSelect.addEventListener('change', (e) => {
                this.settings.fontSize = e.target.value;
                this.applyFontSize();
                this.saveSettings();
            });
        }

        // Language selector
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.value = this.settings.language;
            languageSelect.addEventListener('change', async (e) => {
                this.settings.language = e.target.value;
                this.saveSettings();
                
                // Apply language change immediately
                if (window.translationManager) {
                    await window.translationManager.setLanguage(this.settings.language);
                }
            });
        }

        // Date format selector
        const dateFormatSelect = document.getElementById('dateFormatSelect');
        if (dateFormatSelect) {
            dateFormatSelect.value = this.settings.dateFormat;
            dateFormatSelect.addEventListener('change', (e) => {
                this.settings.dateFormat = e.target.value;
                this.saveSettings();
            });
        }

        // Toggle switches
        const toggles = ['emailNotifications', 'friendRequests', 'gameUpdates', 'showActivity'];
        toggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.checked = this.settings[toggleId];
                toggle.addEventListener('change', (e) => {
                    this.settings[toggleId] = e.target.checked;
                    this.saveSettings();
                });
            }
        });

        // Profile visibility
        const profileVisibility = document.getElementById('profileVisibility');
        if (profileVisibility) {
            profileVisibility.value = this.settings.profileVisibility;
            profileVisibility.addEventListener('change', (e) => {
                this.settings.profileVisibility = e.target.value;
                this.saveSettings();
            });
        }

        // Save button
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                this.showNotification('settings.settingsSaved', 'success');
            });
        }

        // Reset button
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to reset all settings to defaults?')) {
                    await this.resetSettings();
                }
            });
        }
    }

    applySettings() {
        this.applyTheme();
        this.applyFontSize();
    }

    applyTheme() {
        // Use global settings manager if available
        if (window.GameVaultSettings) {
            window.GameVaultSettings.settings.theme = this.settings.theme;
            window.GameVaultSettings.applyTheme();
        } else {
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
        }
        
        // Update theme selector if it exists
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect && this.settings.theme === 'auto') {
            themeSelect.value = 'auto';
        }
    }

    applyFontSize() {
        // Use global settings manager if available
        if (window.GameVaultSettings) {
            window.GameVaultSettings.settings.fontSize = this.settings.fontSize;
            window.GameVaultSettings.applyFontSize();
        } else {
            const root = document.documentElement;
            const fontSizeMap = {
                small: '14px',
                medium: '16px',
                large: '18px',
                xlarge: '20px'
            };
            
            root.style.fontSize = fontSizeMap[this.settings.fontSize] || fontSizeMap.medium;
        }
    }

    async resetSettings() {
        this.settings = {
            theme: 'light',
            fontSize: 'medium',
            language: 'en',
            dateFormat: 'mm/dd/yyyy',
            emailNotifications: false,
            friendRequests: true,
            gameUpdates: true,
            profileVisibility: 'public',
            showActivity: true
        };
        
        // Update UI
        const themeSelect = document.getElementById('themeSelect');
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        const languageSelect = document.getElementById('languageSelect');
        const dateFormatSelect = document.getElementById('dateFormatSelect');
        const profileVisibility = document.getElementById('profileVisibility');
        
        if (themeSelect) themeSelect.value = this.settings.theme;
        if (fontSizeSelect) fontSizeSelect.value = this.settings.fontSize;
        if (languageSelect) languageSelect.value = this.settings.language;
        if (dateFormatSelect) dateFormatSelect.value = this.settings.dateFormat;
        if (profileVisibility) profileVisibility.value = this.settings.profileVisibility;
        
        // Update toggles
        document.getElementById('emailNotifications').checked = this.settings.emailNotifications;
        document.getElementById('friendRequests').checked = this.settings.friendRequests;
        document.getElementById('gameUpdates').checked = this.settings.gameUpdates;
        document.getElementById('showActivity').checked = this.settings.showActivity;
        
        this.applySettings();
        this.saveSettings();
        
        // Reload translations after reset
        if (window.translationManager) {
            await window.translationManager.setLanguage(this.settings.language);
        }
        
        this.showNotification('settings.settingsReset', 'success');
    }

    showNotification(message, type = 'info') {
        // Translate the message if translation manager is available
        let translatedMessage = message;
        if (window.translationManager && typeof message === 'string' && message.includes('.')) {
            // Try to translate if it looks like a translation key
            const translated = window.translationManager.t(message);
            if (translated !== message) {
                translatedMessage = translated;
            }
        }
        
        // Use existing alert system if available
        if (window.app && window.app.showAlert) {
            window.app.showAlert(translatedMessage, window.translationManager ? window.translationManager.t('settings.title') : 'Settings', type);
        } else {
            alert(translatedMessage);
        }
    }
}

// Initialize settings manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.settingsManager = new SettingsManager();
        // Sync with global settings if available
        if (window.GameVaultSettings) {
            window.settingsManager.settings = { ...window.GameVaultSettings.settings };
        }
    });
} else {
    window.settingsManager = new SettingsManager();
    // Sync with global settings if available
    if (window.GameVaultSettings) {
        window.settingsManager.settings = { ...window.GameVaultSettings.settings };
    }
}

