interface OptionThumbProps {
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Option image, or a "none" icon (circle with a slash) when there's no image */
export default function OptionThumb({ src, size = 'md' }: OptionThumbProps) {
  return (
    <span className={`thumb thumb--${size} ${src ? '' : 'thumb--none'}`} aria-hidden>
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}
