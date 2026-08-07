import type { CSSProperties, ReactElement } from 'react'

export type IconName =
  | 'compass'
  | 'plane'
  | 'map'
  | 'suitcase'
  | 'sun'
  | 'moon'
  | 'briefcase'
  | 'building'
  | 'tent'
  | 'snow'
  | 'car'
  | 'users'
  | 'plus'
  | 'search'
  | 'settings'
  | 'menu'
  | 'close'
  | 'check'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronLeft'
  | 'arrowRight'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'download'
  | 'upload'
  | 'clock'
  | 'calendar'
  | 'mapPin'
  | 'star'
  | 'starFilled'
  | 'wallet'
  | 'creditCard'
  | 'receipt'
  | 'chart'
  | 'globe'
  | 'thermometer'
  | 'droplet'
  | 'cloud'
  | 'coffee'
  | 'utensils'
  | 'shirt'
  | 'shield'
  | 'lock'
  | 'unlock'
  | 'file'
  | 'fileText'
  | 'image'
  | 'qr'
  | 'share'
  | 'print'
  | 'sparkle'
  | 'refresh'
  | 'warning'
  | 'info'
  | 'more'
  | 'archive'
  | 'ellipsis'
  | 'database'
  | 'helpCircle'

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}

const paths: Record<IconName, ReactElement> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-2 6-4 2 2-6z" />
    </>
  ),
  plane: <path d="M17.8 19.2 16 11l3.5-3.5c.9-.9.9-2.3 0-3.2s-2.3-.9-3.2 0L12.8 8 4.6 6.2c-.5-.1-1 .1-1.3.5-.4.4-.5 1-.2 1.5L9 12l-4 3-1 2 1 1 2-1 3-4 3.8 5.9c.3.5.9.6 1.5.2.4-.3.6-.8.5-1.3Z" />,
  map: (
    <>
      <path d="M3 6v14l6-3 6 3 6-3V3l-6 3-6-3-6 3z" />
      <path d="M9 3v14M15 6v14" />
    </>
  ),
  suitcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 15.3A8 8 0 0 1 8.7 4 8 8 0 1 0 20 15.3z" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4" />
    </>
  ),
  tent: <path d="M4 20 12 4l8 16M8 20l4-9 4 9M10 20v-4h4v4" />,
  snow: <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18M8.5 3.5 12 6l3.5-2.5M8.5 20.5 12 18l3.5 2.5M3.5 8.5 6 12l-2.5 3.5M20.5 8.5 18 12l2.5 3.5" />,
  car: (
    <>
      <path d="M5 14h14l-1.6-4.7A2 2 0 0 0 15.5 8h-7a2 2 0 0 0-1.9 1.3L5 14z" />
      <rect x="3" y="14" width="18" height="5" rx="1.5" />
      <circle cx="7.5" cy="18.5" r="1.3" />
      <circle cx="16.5" cy="18.5" r="1.3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <circle cx="17" cy="6" r="3" />
      <path d="M22 18c0-3-2.5-5-5-5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12 5 5L20 7" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />,
  edit: <path d="M4 20h4L20 8a2 2 0 0 0-2.8-2.8L5 17.2 4 20zM15 6l3 3" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M4 19h16" />,
  upload: <path d="M12 20V9m0 0-4 4m4-4 4 4M4 5h16" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 22s7-7.6 7-13a7 7 0 1 0-14 0c0 5.4 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  star: <path d="M12 3.6 14.7 9l6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9L12 3.6z" />,
  starFilled: <path fill="currentColor" d="M12 3.6 14.7 9l6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9L12 3.6z" />,
  wallet: <path d="M4 6h13a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM15 13h4M4 6l0-1.5A1.5 1.5 0 0 1 5.5 3H16" />,
  creditCard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  thermometer: <path d="M14 4a2 2 0 0 0-4 0v11a3.5 3.5 0 1 0 4 0V4z" />,
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  cloud: <path d="M17 18H7a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-1A4 4 0 0 1 17 18z" />,
  coffee: <path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8zM17 10h2a2 2 0 0 1 0 4h-2M6 4c0 1.5 2 1.5 2 3M10 4c0 1.5 2 1.5 2 3M14 4c0 1.5 2 1.5 2 3" />,
  utensils: <path d="M5 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M7 12v9M15 3c-1.5 0-3 1.5-3 4.5 0 2 1 4 3 4.5v9" />,
  shirt: <path d="M8 3 4 6l2 3 2-1v13h8V8l2 1 2-3-4-3-2 3h-4L8 3z" />,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </>
  ),
  unlock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </>
  ),
  file: <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l-7-7zM13 3v6h6" />,
  fileText: <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l-7-7zM13 3v6h6M8 13h8M8 17h8M8 9h3" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 20 5-6 4 4 3-3 4 5" />
    </>
  ),
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8 10.5 8-4M8 13.5l8 4" />
    </>
  ),
  print: <path d="M6 8V3h12v5M6 19h12v-8H6zM6 15h12M6 8h12v3H6z" />,
  sparkle: <path d="M12 2 14.3 9 21 11.3 14.3 13.6 12 20.6 9.7 13.6 3 11.3 9.7 9 12 2zM19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3zM5 15l.6 1.6L7 17l-1.6.6L5 19l-.6-1.6L3 17l1.4-.4L5 15z" />,
  refresh: <path d="M4 12a8 8 0 0 1 13.2-6M20 4v5h-5M20 12a8 8 0 0 1-13.2 6M4 20v-5h5" />,
  warning: <path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </>
  ),
  // Drawn as fixed-size filled dots rather than the zero-length-stroke trick
  // (`M x y h.01`) — that rendered a dot only `strokeWidth` px wide, which at
  // this icon's usual small size was practically invisible.
  more: (
    <>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  archive: <path d="M4 4h16v4H4zM5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" />,
  ellipsis: (
    <>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  helpCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 1 1 4.6 2.5c-.8.5-1.4 1-1.4 2.3M12 17h.01" />
    </>
  ),
}

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  className,
  style,
  ariaLabel,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {paths[name]}
    </svg>
  )
}
