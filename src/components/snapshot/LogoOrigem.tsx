interface Props {
  className?: string;
}

/**
 * Approximate recreation of the ORIGEM wordmark (ring icon + bold blue
 * lettering). The source logo was shared as a pasted image with no
 * accessible file, so this is a close stand-in built from CSS/SVG rather
 * than a pixel-exact trace — swap in the real asset file if one becomes
 * available.
 */
export default function LogoOrigem({ className }: Props) {
  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ''}`} style={{ color: '#1e3fcb' }}>
      <svg viewBox="0 0 24 24" className="h-full w-auto shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6">
        <circle cx="12" cy="12" r="9" />
      </svg>
      <span
        className="font-black uppercase leading-none"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '-0.02em' }}
      >
        Rigem
      </span>
    </div>
  );
}
