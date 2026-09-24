/** Coach whistle glyph (Lucide has no whistle) drawn in the same 24px stroke style. */
export default function WhistleIcon({ className, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      <path d="M8 9h11a2 2 0 0 1 2 2v1.5a1 1 0 0 1-1 1h-4.2" />
      <circle cx="8.5" cy="14.5" r="5.5" />
      <circle cx="8.5" cy="14.5" r="1.5" />
      <path d="M8 9V5.5M5 7l3-1.5" />
    </svg>
  );
}
