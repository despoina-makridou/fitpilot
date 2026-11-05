/** Central design tokens. Dark theme, energetic lime accent. */
export const theme = {
  colors: {
    bg: '#0B0F0E',
    surface: '#151B19',
    surfaceAlt: '#1E2624',
    border: '#2A3330',
    text: '#F2F5F4',
    textDim: '#9AA6A2',
    textFaint: '#5E6B67',
    accent: '#B4FF39', // energetic lime
    accentDim: '#7FB828',
    onAccent: '#0B0F0E',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },
  radius: { sm: 8, md: 14, lg: 22, pill: 999 },
  space: (n: number) => n * 4,
  font: {
    h1: 30,
    h2: 22,
    h3: 18,
    body: 15,
    small: 13,
    tiny: 11,
  },
} as const;

export type Theme = typeof theme;
