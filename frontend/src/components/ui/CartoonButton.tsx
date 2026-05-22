import { Button, type ButtonProps } from 'antd'
import { motion } from 'framer-motion'

export default function CartoonButton(props: ButtonProps) {
  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
      <Button
        {...props}
        style={{
          borderRadius: 16,
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(255,107,107,0.25)',
          ...props.style,
        }}
      />
    </motion.div>
  )
}
