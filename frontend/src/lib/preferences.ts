export interface Preferences { largeText: boolean; highContrast: boolean; reduceMotion: boolean }
export const defaultPreferences: Preferences = { largeText: false, highContrast: false, reduceMotion: false }
export function readPreferences(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem('neurospeech-preferences') || '{}') as Partial<Preferences>
    return { largeText: raw.largeText === true, highContrast: raw.highContrast === true, reduceMotion: raw.reduceMotion === true }
  } catch { return defaultPreferences }
}
export function applyPreferences(value: Preferences) {
  document.documentElement.dataset.largeText = String(value.largeText)
  document.documentElement.dataset.highContrast = String(value.highContrast)
  document.documentElement.dataset.reduceMotion = String(value.reduceMotion)
}
