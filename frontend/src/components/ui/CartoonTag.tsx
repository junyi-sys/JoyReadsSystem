import { Tag, type TagProps } from 'antd'

export default function CartoonTag(props: TagProps) {
  return (
    <Tag {...props} style={{ borderRadius: 10, fontWeight: 500, ...props.style }} />
  )
}
