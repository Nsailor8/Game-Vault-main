// Translation Manager
class TranslationManager {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'en';
        this.loadedLanguages = new Set();
    }

    // Load translation file for a specific language
    async loadLanguage(lang) {
        if (this.loadedLanguages.has(lang)) {
            return Promise.resolve();
        }

        try {
            const response = await fetch(`/translations/${lang}.json`);
            if (!response.ok) {
                console.warn(`Translation file for ${lang} not found, falling back to English`);
                if (lang !== 'en') {
                    return this.loadLanguage('en');
                }
                return Promise.resolve();
            }
            const translations = await response.json();
            this.translations[lang] = translations;
            this.loadedLanguages.add(lang);
            return Promise.resolve();
        } catch (error) {
            console.error(`Error loading translation for ${lang}:`, error);
            if (lang !== 'en') {
                return this.loadLanguage('en');
            }
            return Promise.resolve();
        }
    }

    // Set the current language and load translations if needed
    async setLanguage(lang) {
        this.currentLanguage = lang || 'en';
        
        // Load the language if not already loaded
        if (!this.loadedLanguages.has(this.currentLanguage)) {
            await this.loadLanguage(this.currentLanguage);
        }

        // Apply translations to the page
        this.applyTranslations();
    }

    // Get a translation by key (supports nested keys like "settings.title")
    translate(key, fallback = null) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Fallback to English if translation not found
                if (this.currentLanguage !== 'en' && this.translations['en']) {
                    let enValue = this.translations['en'];
                    for (const enKey of keys) {
                        if (enValue && typeof enValue === 'object' && enKey in enValue) {
                            enValue = enValue[enKey];
                        } else {
                            return fallback || key;
                        }
                    }
                    return enValue;
                }
                return fallback || key;
            }
        }

        return value || fallback || key;
    }

    // Shortcut method
    t(key, fallback = null) {
        return this.translate(key, fallback);
    }

    // Apply translations to elements with data-i18n attribute
    applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            
            // Handle different element types
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else if (element.tagName === 'INPUT' && (element.type === 'submit' || element.type === 'button')) {
                element.value = translation;
            } else if (element.tagName === 'BUTTON') {
                element.textContent = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Apply translations to elements with data-i18n-html (for innerHTML)
        const htmlElements = document.querySelectorAll('[data-i18n-html]');
        htmlElements.forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            const translation = this.translate(key);
            element.innerHTML = translation;
        });

        // Apply translations to title attributes
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.translate(key);
            element.title = translation;
        });
    }

    // Initialize with language from settings
    async init() {
        // Get language from settings
        const savedSettings = localStorage.getItem('gameVaultSettings');
        let language = 'en';
        
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                language = settings.language || 'en';
            } catch (e) {
                console.error('Error loading language from settings:', e);
            }
        }

        // Load the language
        await this.setLanguage(language);
    }
}

// Create global instance
window.translationManager = new TranslationManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.translationManager.init();
    });
} else {
    window.translationManager.init();
}

