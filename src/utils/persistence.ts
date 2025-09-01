/**
 * Client-side persistence utilities for Hydroscope settings
 */

export const STORAGE_KEYS = {
  RENDER_CONFIG: 'hydroscope:renderConfig',
  COLOR_PALETTE: 'hydroscope:colorPalette',
  LAYOUT_ALGORITHM: 'hydroscope:layoutAlgorithm',
  AUTO_FIT: 'hydroscope:autoFit',
} as const;

/**
 * Safely save data to localStorage with error handling
 */
export const saveToStorage = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to save to localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Safely load data from localStorage with fallback
 */
export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load from localStorage (${key}):`, error);
    return defaultValue;
  }
};

/**
 * Check if localStorage is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Clear all Hydroscope-related storage
 */
export const clearHydroscopeStorage = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('Failed to clear Hydroscope storage:', error);
  }
};

/**
 * Get all persisted Hydroscope settings
 */
export const getPersistedSettings = () => {
  return {
    renderConfig: loadFromStorage(STORAGE_KEYS.RENDER_CONFIG, null),
    colorPalette: loadFromStorage(STORAGE_KEYS.COLOR_PALETTE, null),
    layoutAlgorithm: loadFromStorage(STORAGE_KEYS.LAYOUT_ALGORITHM, null),
    autoFit: loadFromStorage(STORAGE_KEYS.AUTO_FIT, null),
  };
};
