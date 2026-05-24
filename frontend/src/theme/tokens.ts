export const colors = {
  primary: '#6DBF6E',
  primaryLight: '#8FD490',
  primaryDark: '#4FA050',
  secondary: '#4DABF7',
  secondaryLight: '#74C0FC',
  accent: '#FFD43B',
  accentLight: '#FFE88A',
  warm: '#69C76E',
  bg: '#F0F7F4',
  bgCard: '#FFFFFF',
  text: '#2C3E34',
  textMuted: '#94A89C',
  textLight: '#888888',
  success: '#52C41A',
  warning: '#FAAD14',
  danger: '#FF4D4F',
  zone: {
    target: '#6DBF6E',
    scout: '#FFD43B',
    ally: '#4DABF7',
    lost: '#BCCFC2',
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
  card: '0 4px 16px rgba(109, 191, 110, 0.12)',
  button: '0 4px 12px rgba(109, 191, 110, 0.25)',
  hover: '0 6px 20px rgba(109, 191, 110, 0.20)',
  popup: '0 8px 32px rgba(0, 0, 0, 0.10)',
} as const

export const font = {
  title: '"ZCOOL KuaiLe", "KaiTi", cursive',
  body: 'system-ui, -apple-system, "Microsoft YaHei", sans-serif',
  content: '"KaiTi", "楷体", serif',
} as const
