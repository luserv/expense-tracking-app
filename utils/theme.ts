/**
 * Design system tokens — Segato
 *
 * Scene: Commuter reviewing weekly spend on an OLED Android phone at night.
 * AMOLED Night Mode — background is literal #000000 so pixels power off,
 * saving battery on OLED/AMOLED screens. Semantic green/red carry full
 * emotional weight against the true black canvas.
 * Strategy: Committed — the black void IS the product environment.
 */

// ── Colors ────────────────────────────────────────────────────────────────────

export const C = {
  // Backgrounds — true AMOLED black stack (pixels off on OLED)
  bg:          '#000000',  // page background — pixel-off AMOLED black
  surface:     '#0D0D0D',  // card / list row — barely-lifted
  surfaceUp:   '#161616',  // elevated (modal body, input, chip)
  surfaceHigh: '#1E1E1E',  // top surface (active state, table header)
  border:      '#202020',  // dividers — neutral, no blue cast
  borderFaint: '#111111',  // hairline separators

  // Primary brand
  accent:      '#5B7CF6',  // indigo — CTAs, active tabs, FAB
  accentPress: '#4A68DC',  // pressed state
  accentBg:    'rgba(91,124,246,0.15)',  // slightly more visible on true black

  // Semantic money states
  income:      '#10D982',
  incomeBg:    'rgba(16,217,130,0.13)',
  expense:     '#F64458',
  expenseBg:   'rgba(246,68,88,0.13)',
  transfer:    '#A78BFA',
  transferBg:  'rgba(167,139,250,0.13)',
  warn:        '#F59E0B',
  warnBg:      'rgba(245,158,11,0.13)',
  loan:        '#FB923C',
  loanBg:      'rgba(251,146,60,0.13)',
  danger:      '#F64458',

  // Text
  text:        '#EEF2FF',  // primary — near-white, blue-tinted
  textSec:     '#8895B3',  // secondary — muted
  textDim:     '#4E5A78',  // tertiary — very dim
  textInverse: '#000000',  // on light surfaces

  // Overlays
  scrim:       'rgba(0,0,0,0.80)',  // stronger on true black context
  scrimLight:  'rgba(0,0,0,0.56)',
} as const;

// ── Typography scale ──────────────────────────────────────────────────────────

export const F = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────

export const S = {
  '2xs': 4,
  xs:    6,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

// ── Border radii ──────────────────────────────────────────────────────────────

export const R = {
  xs:  6,
  sm:  10,
  md:  14,
  lg:  18,
  xl:  24,
  full: 999,
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
