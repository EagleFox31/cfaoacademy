export default function ComboFlag({ src, srcSet, className = 'combo-flag' }) {
  if (!src) return null
  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      decoding="async"
    />
  )
}
