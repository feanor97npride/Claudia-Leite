interface Props {
  className?: string;
}

/**
 * Approximate recreation of the ORIGEM wordmark (bold blue lettering).
 * The source logo was shared as a pasted image with no accessible file,
 * so this is a close stand-in built from plain styled text rather than a
 * pixel-exact trace — swap in the real asset file if one becomes available.
 */
export default function LogoOrigem({ className }: Props) {
  return (
    <span
      className={`font-black uppercase leading-none ${className ?? ''}`}
      style={{ color: '#1e3fcb', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '-0.01em' }}
    >
      Origem
    </span>
  );
}
