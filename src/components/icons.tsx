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

export const SettingsIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
)

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20l1.3-3.9A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
)

export const SendIcon = () => (
  <svg {...base}>
    <path d="M4 12 20 4l-6 16-2.5-6.5L4 12z" />
  </svg>
)

export const SpeakerIcon = () => (
  <svg {...base}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const PeopleIcon = () => (
  <svg {...base}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 19a5 5 0 0 0-3-4.6" />
  </svg>
)

export const EnterIcon = () => (
  <svg {...base}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5M15 12H3" />
  </svg>
)

export const DocIcon = () => (
  <svg {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
)
