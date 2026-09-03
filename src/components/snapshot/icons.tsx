import type { CSSProperties } from 'react';

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconLayers({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

export function IconCalendar({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconCheck({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconAlert({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconClock({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconTrendingUp({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  );
}

export function IconSpark({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}

export function IconFlag({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M4 3v18" />
      <path d="M4 4h13l-2.5 4L17 12H4" />
    </svg>
  );
}

export function IconTarget({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function IconGauge({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M12 14 15.5 9" />
      <path d="M3.5 19a9 9 0 1 1 17 0" />
    </svg>
  );
}

export function IconUsers({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconArrowRight({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} {...base}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
