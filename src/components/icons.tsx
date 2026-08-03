// Minimal SF-Symbols-style line icons. Inherit color via currentColor.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const MicIcon = () => (
  <svg {...base}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
)

export const MicOffIcon = () => (
  <svg {...base}>
    <path d="M9 9v2a3 3 0 0 0 4.5 2.6M15 11V6a3 3 0 0 0-5.8-1.1" />
    <path d="M5 11a7 7 0 0 0 10.5 6.1M19 11a7 7 0 0 1-.5 2.6M12 18v3" />
    <path d="M4 3l16 16" />
  </svg>
)

export const VideoIcon = () => (
  <svg {...base}>
    <rect x="3" y="6" width="12" height="12" rx="3" />
    <path d="M15 10.5 21 7v10l-6-3.5z" />
  </svg>
)

export const VideoOffIcon = () => (
  <svg {...base}>
    <path d="M15 10.5 21 7v10l-6-3.5M15 9v6a3 3 0 0 1-3 3H6" />
    <path d="M3 8a3 3 0 0 1 3-3h6" />
    <path d="M4 3l16 16" />
  </svg>
)

export const ScreenIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
)

export const LeaveIcon = () => (
  <svg {...base}>
    <path d="M6.5 10.5a13 13 0 0 1 11 0l.6 2a1.5 1.5 0 0 1-1 1.8l-2.3.6a1.3 1.3 0 0 1-1.4-.6l-.9-1.5a10 10 0 0 0-2 0l-.9 1.5a1.3 1.3 0 0 1-1.4.6l-2.3-.6a1.5 1.5 0 0 1-1-1.8z" />
  </svg>
)

export const CopyIcon = () => (
  <svg {...base}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...base}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
