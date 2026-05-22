export const colors = {
  primary: '#FF6B6B',
  primaryLight: '#FF8E8E',
  primaryDark: '#E55A5A',
  secondary: '#4ECDC4',
  secondaryLight: '#6ED8D1',
  accent: '#FFE66D',
  accentLight: '#FFF0A0',
  warm: '#FF8E72',
  bg: '#FFF8F0',
  bgCard: '#FFFFFF',
  text: '#3D3D3D',
  textMuted: '#B0A8A0',
  textLight: '#888888',
  success: '#52C41A',
  warning: '#FAAD14',
  danger: '#FF4D4F',
  zone: {
    target: '#FF6B6B',
    scout: '#FFE66D',
    ally: '#4ECDC4',
    lost: '#B0A8A0',
  },
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const shadows = {
  card: '0 4px 16px rgba(255, 107, 107, 0.12)',
  button: '0 4px 12px rgba(255, 107, 107, 0.25)',
  hover: '0 6px 20px rgba(255, 107, 107, 0.20)',
  popup: '0 8px 32px rgba(0, 0, 0, 0.12)',
} as const

export const font = {
  title: '"ZCOOL KuaiLe", "KaiTi", cursive',
  body: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif',
  content: '"KaiTi", "楷体", serif',
} as const
