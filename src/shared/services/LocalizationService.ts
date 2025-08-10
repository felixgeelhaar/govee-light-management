/**
 * Comprehensive localization service for Stream Deck plugin
 * Supports multiple languages with fallback to English
 */

export type SupportedLanguage = 'en' | 'de' | 'fr' | 'es';

export interface LocalizationData {
  Name: string;
  Description: string;
  Category: string;
  
  Actions: {
    Toggle: { Name: string; Tooltip: string };
    Brightness: { Name: string; Tooltip: string };
    Color: { Name: string; Tooltip: string };
    Warmth: { Name: string; Tooltip: string };
  };
  
  Settings: {
    ApiKey: string;
    ApiKeyHelp: string;
    ConnectionStatus: string;
    TestConnection: string;
    SaveApiKey: string;
    DefaultBrightness: string;
    DefaultColorTemp: string;
    AutoDiscover: string;
    AutoDiscoverHelp: string;
    InterfaceLanguage: string;
    HighContrast: string;
    HighContrastHelp: string;
    ScreenReader: string;
    ScreenReaderHelp: string;
  };
  
  Status: {
    Connected: string;
    NotConnected: string;
    Testing: string;
    Warning: string;
    ConnectedSuccessfully: string;
    InvalidApiKey: string;
    ConnectionFailed: string;
    ApiKeyRequired: string;
  };
  
  Messages: {
    SettingsSaved: string;
    SettingsSaveFailed: string;
    DeviceOffline: string;
    InvalidSettings: string;
    DeviceNotFound: string;
    OperationTimeout: string;
    TooManyRequests: string;
  };
}

export class LocalizationService {
  private static instance: LocalizationService;
  private currentLanguage: SupportedLanguage = 'en';
  private translations: Map<SupportedLanguage, LocalizationData> = new Map();
  
  private constructor() {
    this.loadTranslations();
  }
  
  public static getInstance(): LocalizationService {
    if (!LocalizationService.instance) {
      LocalizationService.instance = new LocalizationService();
    }
    return LocalizationService.instance;
  }
  
  /**
   * Set the current language
   */
  public setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
  }
  
  /**
   * Get the current language
   */
  public getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }
  
  /**
   * Get localized text by key path
   */
  public getText(keyPath: string): string {
    const keys = keyPath.split('.');
    const translation = this.translations.get(this.currentLanguage);
    const fallback = this.translations.get('en');
    
    if (!translation && !fallback) {
      return keyPath; // Return key if no translations available
    }
    
    // Try current language first
    let value = this.getNestedValue(translation, keys);
    
    // Fallback to English if not found
    if (!value && this.currentLanguage !== 'en') {
      value = this.getNestedValue(fallback, keys);
    }
    
    return value || keyPath;
  }
  
  /**
   * Get localized text with variable substitution
   */
  public getTextWithVars(keyPath: string, variables: Record<string, string | number>): string {
    let text = this.getText(keyPath);
    
    // Replace variables in format {variableName}
    Object.entries(variables).forEach(([key, value]) => {
      text = text.replace(new RegExp(`{${key}}`, 'g'), String(value));
    });
    
    return text;
  }
  
  /**
   * Get all translations for current language
   */
  public getAllTranslations(): LocalizationData | undefined {
    return this.translations.get(this.currentLanguage);
  }
  
  /**
   * Check if a language is supported
   */
  public isLanguageSupported(language: string): language is SupportedLanguage {
    return ['en', 'de', 'fr', 'es'].includes(language);
  }
  
  /**
   * Get list of supported languages
   */
  public getSupportedLanguages(): { code: SupportedLanguage; name: string; nativeName: string }[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' }
    ];
  }
  
  /**
   * Auto-detect language from browser or system
   */
  public autoDetectLanguage(): SupportedLanguage {
    // Try browser language first
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language.split('-')[0];
      if (this.isLanguageSupported(browserLang)) {
        return browserLang;
      }
    }
    
    // Try system language (Node.js environment)
    if (typeof process !== 'undefined' && process.env.LANG) {
      const systemLang = process.env.LANG.split('_')[0];
      if (this.isLanguageSupported(systemLang)) {
        return systemLang;
      }
    }
    
    return 'en'; // Default fallback
  }
  
  /**
   * Load translation data (in real implementation, this would load from files)
   */
  private loadTranslations(): void {
    // English translations (always loaded as fallback)
    this.translations.set('en', {
      Name: "Govee Light Management",
      Description: "Professional Govee smart light control with Stream Deck Plus dial support",
      Category: "Smart Home",
      
      Actions: {
        Toggle: {
          Name: "Toggle On/Off",
          Tooltip: "Toggle individual lights on/off with Stream Deck+ support"
        },
        Brightness: {
          Name: "Brightness Control", 
          Tooltip: "Control brightness with dial rotation and touchscreen on Stream Deck+"
        },
        Color: {
          Name: "Color Control",
          Tooltip: "Control color with presets or hue adjustment on Stream Deck+"
        },
        Warmth: {
          Name: "Color Temperature",
          Tooltip: "Control color temperature (warmth) with dial rotation on Stream Deck+"
        }
      },
      
      Settings: {
        ApiKey: "Govee API Key",
        ApiKeyHelp: "Get your API key from the Govee Home app: Profile → Settings → Apply for API Key",
        ConnectionStatus: "Connection Status",
        TestConnection: "Test Connection",
        SaveApiKey: "Save API Key",
        DefaultBrightness: "Default Brightness (%)",
        DefaultColorTemp: "Default Color Temperature (K)",
        AutoDiscover: "Auto-discover new devices",
        AutoDiscoverHelp: "Automatically detect new Govee devices when they come online",
        InterfaceLanguage: "Interface Language",
        HighContrast: "Enhanced contrast mode",
        HighContrastHelp: "Increases visual contrast for better accessibility",
        ScreenReader: "Enhanced screen reader support",
        ScreenReaderHelp: "Provides additional announcements for screen reader users"
      },
      
      Status: {
        Connected: "Connected",
        NotConnected: "Not Connected", 
        Testing: "Testing...",
        Warning: "Warning",
        ConnectedSuccessfully: "Connected Successfully",
        InvalidApiKey: "Invalid API Key",
        ConnectionFailed: "Connection Failed",
        ApiKeyRequired: "API Key Required"
      },
      
      Messages: {
        SettingsSaved: "Settings saved successfully",
        SettingsSaveFailed: "Failed to save settings",
        DeviceOffline: "Device is offline or unreachable",
        InvalidSettings: "Invalid settings. Please check your configuration",
        DeviceNotFound: "Device not found. It may have been removed",
        OperationTimeout: "Operation timed out. Please try again",
        TooManyRequests: "Too many requests. Please wait a moment"
      }
    });
    
    // German translations
    this.translations.set('de', {
      Name: "Govee Licht-Management",
      Description: "Professionelle Govee Smart-Licht-Steuerung mit Stream Deck Plus Drehregler-Unterstützung",
      Category: "Smart Home",
      
      Actions: {
        Toggle: {
          Name: "Ein/Aus schalten",
          Tooltip: "Einzelne Lichter ein/aus schalten mit Stream Deck+ Unterstützung"
        },
        Brightness: {
          Name: "Helligkeits-Steuerung", 
          Tooltip: "Helligkeit mit Drehregler und Touchscreen am Stream Deck+ steuern"
        },
        Color: {
          Name: "Farb-Steuerung",
          Tooltip: "Farbe mit Voreinstellungen oder Farbton-Anpassung am Stream Deck+ steuern"
        },
        Warmth: {
          Name: "Farbtemperatur",
          Tooltip: "Farbtemperatur (Wärme) mit Drehregler am Stream Deck+ steuern"
        }
      },
      
      Settings: {
        ApiKey: "Govee API-Schlüssel",
        ApiKeyHelp: "Holen Sie sich Ihren API-Schlüssel aus der Govee Home App: Profil → Einstellungen → API-Schlüssel beantragen",
        ConnectionStatus: "Verbindungsstatus",
        TestConnection: "Verbindung testen",
        SaveApiKey: "API-Schlüssel speichern",
        DefaultBrightness: "Standard-Helligkeit (%)",
        DefaultColorTemp: "Standard-Farbtemperatur (K)",
        AutoDiscover: "Neue Geräte automatisch erkennen",
        AutoDiscoverHelp: "Neue Govee-Geräte automatisch erkennen, wenn sie online kommen",
        InterfaceLanguage: "Oberflächensprache",
        HighContrast: "Verstärkter Kontrast-Modus",
        HighContrastHelp: "Erhöht den visuellen Kontrast für bessere Zugänglichkeit",
        ScreenReader: "Erweiterte Bildschirmleser-Unterstützung",
        ScreenReaderHelp: "Bietet zusätzliche Ansagen für Bildschirmleser-Benutzer"
      },
      
      Status: {
        Connected: "Verbunden",
        NotConnected: "Nicht verbunden", 
        Testing: "Teste...",
        Warning: "Warnung",
        ConnectedSuccessfully: "Erfolgreich verbunden",
        InvalidApiKey: "Ungültiger API-Schlüssel",
        ConnectionFailed: "Verbindung fehlgeschlagen",
        ApiKeyRequired: "API-Schlüssel erforderlich"
      },
      
      Messages: {
        SettingsSaved: "Einstellungen erfolgreich gespeichert",
        SettingsSaveFailed: "Fehler beim Speichern der Einstellungen",
        DeviceOffline: "Gerät ist offline oder nicht erreichbar",
        InvalidSettings: "Ungültige Einstellungen. Bitte überprüfen Sie Ihre Konfiguration",
        DeviceNotFound: "Gerät nicht gefunden. Es wurde möglicherweise entfernt",
        OperationTimeout: "Vorgang-Timeout. Bitte versuchen Sie es erneut",
        TooManyRequests: "Zu viele Anfragen. Bitte warten Sie einen Moment"
      }
    });
  }
  
  /**
   * Get nested value from object using key path
   */
  private getNestedValue(obj: any, keys: string[]): string | undefined {
    return keys.reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }
}

// Export singleton instance
export const localizationService = LocalizationService.getInstance();

// Export convenience function for templates
export const t = (keyPath: string, variables?: Record<string, string | number>) => {
  return variables 
    ? localizationService.getTextWithVars(keyPath, variables)
    : localizationService.getText(keyPath);
};