import type { Variants } from 'framer-motion'

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
}

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 20 } },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

export const wiggle: Variants = {
  animate: { rotate: [0, -3, 3, -3, 0], transition: { duration: 0.5 } },
}

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export const pulse: Variants = {
  animate: { scale: [1, 1.05, 1], transition: { duration: 1.5, repeat: Infinity } },
}
