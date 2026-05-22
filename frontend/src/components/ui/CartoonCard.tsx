import { Card, type CardProps } from 'antd'
import { motion } from 'framer-motion'

export default function CartoonCard(props: CardProps) {
  return (
    <motion.div whileHover={{ y: -2 }}>
      <Card
        {...props}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 16px rgba(255,107,107,0.12)',
          border: 'none',
          ...props.style,
        }}
      />
    </motion.div>
  )
}
