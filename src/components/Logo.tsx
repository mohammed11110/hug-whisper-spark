interface Props {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="amlakiKey" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="hsl(var(--sage-400))" />
          <stop offset="100%" stopColor="hsl(var(--sage-600))" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="13" stroke="url(#amlakiKey)" strokeWidth="4" fill="none" />
      <circle cx="22" cy="22" r="4" fill="url(#amlakiKey)" />
      <path
        d="M31 31 L52 52"
        stroke="url(#amlakiKey)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M44 44 L50 38" stroke="url(#amlakiKey)" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 48 L54 42" stroke="url(#amlakiKey)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
