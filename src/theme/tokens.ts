// Night theme design tokens. Dark only for the MVP.
export const colors = {
  background: '#0B0B12',
  surface: '#161622',
  surfaceRaised: '#1F1F2E',
  border: '#2A2A3C',
  text: '#F5F5FA',
  textMuted: '#9A9AB0',
  accent: '#FF5A36', // Onspot orange: live, fresh, primary actions
  accentSoft: 'rgba(255, 90, 54, 0.16)',
  live: '#3DDC84', // freshness ring / "live now"
  warning: '#FFB020',
  danger: '#FF4D6A',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '500' },
} as const;
