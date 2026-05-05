/** Decorative sage leaves SVG for hero cards */
export function BotanicalDecor({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g opacity="0.18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M150 20 Q170 60 160 110 Q155 140 130 165" />
        <path d="M160 60 Q175 55 188 70" fill="currentColor" fillOpacity="0.4" />
        <path d="M155 90 Q172 88 185 105" fill="currentColor" fillOpacity="0.4" />
        <path d="M150 120 Q165 122 178 140" fill="currentColor" fillOpacity="0.4" />
        <path d="M140 145 Q150 152 158 168" fill="currentColor" fillOpacity="0.4" />
        <path d="M30 180 Q45 140 70 120" />
        <path d="M40 160 Q28 158 18 168" fill="currentColor" fillOpacity="0.3" />
        <path d="M55 140 Q40 138 28 150" fill="currentColor" fillOpacity="0.3" />
      </g>
    </svg>
  );
}
