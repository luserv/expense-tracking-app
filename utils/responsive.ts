/**
 * Responsive layout utilities — Segato
 *
 * Breakpoints (based on content width):
 *   sm  — < 640   phone
 *   md  — 640–1023  tablet / large phone landscape
 *   lg  — 1024+   desktop / Electron
 */
import { useWindowDimensions } from 'react-native';

export const BP = {
  md: 640,
  lg: 1024,
} as const;

/** Sidebar width on desktop */
export const SIDEBAR_W = 224;

/** Max content width for the main area on desktop */
export const CONTENT_MAX_W = 900;

/** Max form / modal width */
export const FORM_MAX_W = 520;

export interface Layout {
  width: number;
  height: number;
  /** phone portrait */
  isPhone: boolean;
  /** tablet / large phone landscape */
  isTablet: boolean;
  /** desktop / Electron */
  isDesktop: boolean;
  /** phone OR tablet (not desktop) */
  isMobile: boolean;
  /** Number of columns to use for card grids */
  cols: 1 | 2 | 3;
  /** Horizontal page padding */
  px: number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const isPhone   = width < BP.md;
  const isTablet  = width >= BP.md && width < BP.lg;
  const isDesktop = width >= BP.lg;
  const cols: 1 | 2 | 3 = isDesktop ? 3 : isTablet ? 2 : 1;
  const px = isDesktop ? 32 : isTablet ? 24 : 16;

  return { width, height, isPhone, isTablet, isDesktop, isMobile: !isDesktop, cols, px };
}

/**
 * Returns a style object that centers and constrains content
 * on desktop, while flowing full-width on phone/tablet.
 */
export function contentContainerStyle(l: Layout): object {
  if (!l.isDesktop) return {};
  return {
    maxWidth: CONTENT_MAX_W,
    width: '100%' as any,
    alignSelf: 'center' as const,
  };
}

/**
 * Calculates a flex-wrap card width given:
 *  - total cols
 *  - gap between cards
 *  - optional total container width (defaults to full)
 */
export function cardWidth(cols: number, gap: number, containerWidth?: number): string | number {
  if (cols === 1) return '100%';
  // percentages for flex-wrap — subtract gap contribution per item
  // use slightly less than equal share so rounding never breaks wrap
  const pct = (100 / cols) - 0.5;
  return `${pct}%` as any;
}
