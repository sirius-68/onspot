// Light theme design tokens, matched to the owner's reference screens (2026-11-16):
// white surfaces, rounded photo cards with white borders, blue active tab, orange accents.
export const colors = {
  background: '#FFFFFF',
  surface: '#F4F4F7',
  surfaceRaised: '#FFFFFF',
  border: '#ECECF1',
  text: '#111114',
  textMuted: '#8E8E99',
  accent: '#FF6A2C', // Onspot orange: primary actions, outgoing messages, splits
  accentSoft: 'rgba(255, 106, 44, 0.12)',
  blue: '#1E88FF', // active tab, links, map pins
  blueSoft: 'rgba(30, 136, 255, 0.12)',
  purple: '#B8A6FF', // friend bubbles
  live: '#22C55E', // freshness / "live now"
  warning: '#F59E0B',
  danger: '#EF4444',
  bubbleIn: '#F1F1F4',
  ink: '#1C1C1F', // send button, dark chips
  white: '#FFFFFF',
} as const;

/** Orange gradient for split cards and highlights. */
export const accentGradient = ['#FFA24C', '#FF5A1F'] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '500' },
} as const;
