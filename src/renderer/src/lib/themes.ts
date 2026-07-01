export const THEMES = [
  { id: 'ocean', name: 'Ocean', accent: '#3b82f6', accentLight: '#60a5fa' },
  { id: 'emerald', name: 'Emerald', accent: '#10b981', accentLight: '#34d399' },
  { id: 'violet', name: 'Violet', accent: '#8b5cf6', accentLight: '#a78bfa' },
  { id: 'amber', name: 'Amber', accent: '#f59e0b', accentLight: '#fbbf24' },
  { id: 'rose', name: 'Rose', accent: '#f43f5e', accentLight: '#fb7185' }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.dataset.theme = themeId
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  document.documentElement.style.setProperty('--accent', theme.accent)
  document.documentElement.style.setProperty('--accent-light', theme.accentLight)
}
