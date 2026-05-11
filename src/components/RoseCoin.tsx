export function RoseCoin({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="rcg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ff86c8" />
          <stop offset="60%" stopColor="#e91e8c" />
          <stop offset="100%" stopColor="#7a0a3d" />
        </radialGradient>
        <linearGradient id="rcr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd1e6" />
          <stop offset="100%" stopColor="#c2185b" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#rcg)" stroke="#ff4fa3" strokeWidth="2" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#ffb6da" strokeWidth="0.5" opacity="0.5" />
      {/* Stylized rose */}
      <g transform="translate(32 34)">
        <circle r="11" fill="url(#rcr)" />
        <path
          d="M 0 -8 C 6 -6, 8 0, 4 6 C 0 10, -6 8, -8 2 C -10 -4, -4 -10, 0 -8 Z"
          fill="#ff4f9b"
          opacity="0.85"
        />
        <path
          d="M -3 -3 C 2 -4, 5 0, 3 4 C 0 6, -4 4, -5 0 C -5 -2, -3 -4, -3 -3 Z"
          fill="#ffb3d4"
        />
        <circle r="2" fill="#fff5fa" />
      </g>
    </svg>
  );
}
