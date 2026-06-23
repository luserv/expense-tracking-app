---
name: Segato — Control de Gastos
description: Offline-first personal finance tracker. Every transaction logged, every balance instant.
colors:
  precision-indigo: "#5B7CF6"
  precision-indigo-press: "#4A68DC"
  cleared-green: "#10D982"
  deficit-red: "#F64458"
  transfer-violet: "#A78BFA"
  warn-amber: "#F59E0B"
  loan-orange: "#FB923C"
  abyss: "#000000"
  surface: "#0D0D0D"
  surface-up: "#161616"
  surface-high: "#1E1E1E"
  border: "#202020"
  border-faint: "#111111"
  ink: "#EEF2FF"
  ink-sec: "#8895B3"
  ink-dim: "#4E5A78"
typography:
  display:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.3px"
  title:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.1px"
  caption:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.3px"
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  full: "9999px"
spacing:
  2xs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
components:
  btn-save:
    backgroundColor: "{colors.precision-indigo}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
  btn-save-hover:
    backgroundColor: "{colors.precision-indigo-press}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
  btn-cancel:
    backgroundColor: "{colors.surface-up}"
    textColor: "{colors.ink-sec}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
  chip-type-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-sec}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  chip-tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink-sec}"
    rounded: "{rounded.full}"
    padding: "7px 12px"
  input-default:
    backgroundColor: "{colors.surface-up}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  input-focus:
    backgroundColor: "{colors.surface-up}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  fab:
    backgroundColor: "{colors.precision-indigo}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "58px"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  nav-item-active:
    backgroundColor: "#0E1325"
    textColor: "{colors.precision-indigo}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
---

# Design System: Segato — Control de Gastos

## 1. Overview

**Creative North Star: "The Personal Comptroller"**

Segato is built for the user who ends their day by reviewing the ledger: not to worry, but to know. The interface is a private instrument — dark by design, dense by purpose, immediate in every response. The true-black canvas (`#000000`) is literal: on AMOLED screens, black pixels are off and draw no power. Numbers stand in relief against the void. The product is the data; everything else earns its place by clarifying it.

This system rejects both ends of the consumer finance spectrum. It is not Mint or Intuit: no notification badges competing for attention, no congratulatory messages for routine events, no ad placements threading through the transaction list. It is not a banking app either: no cold institutional palettes, no excessive whitespace that turns a five-minute task into a ten-minute one. And it is not a SaaS dashboard: no hero metrics, no gradient text over big numbers, no UI that celebrates itself instead of serving the data. The system most resembles a quality accounting book — organized, unhurried, exact — held in pocket form.

The color strategy is Committed. The void carries roughly 70% of every screen. The five semantic hues (indigo, green, red, violet, amber) carry fixed financial meanings and appear nowhere else. Precision Indigo, the only non-semantic accent, earns its rarity: it marks exactly one thing at a time.

**Key Characteristics:**
- AMOLED-native true-black canvas; the background is the battery-saving feature
- A semantic color vocabulary where every hue owns one financial meaning
- Precision Indigo reserved exclusively for action and active state
- System-native typeface; no display face competes with amounts
- Firm, direct interactions: press feedback is immediate, transitions are short
- Structurally responsive: bottom tabs on mobile, left sidebar on desktop

## 2. Colors: The AMOLED Ledger

Five semantic hues on a four-step void. Color conveys financial type and state; anything without a financial meaning uses neutral only.

### Primary
- **Precision Indigo** (`#5B7CF6`): The one active voice in the system. Applied to primary buttons, the FAB, active navigation icons and labels, selected item indicators, and form focus borders. Pressed state is `#4A68DC`. The background tint used for active states is `rgba(91,124,246,0.15)` — visible on true black, invisible on anything lighter.

### Secondary
- **Cleared Green** (`#10D982`): Income amounts, positive balance figures, settled loan markers. The background tint (`rgba(16,217,130,0.13)`) is used for income category avatars and semantic chip states.
- **Deficit Red** (`#F64458`): Expense amounts, negative balance figures, required-field markers, error states. Tint: `rgba(246,68,88,0.13)`.
- **Transfer Violet** (`#A78BFA`): Fund transfers between accounts. Kept distinct from income and expense so transfers are classifiable at a glance, not by reading the label. Tint: `rgba(167,139,250,0.13)`.

### Tertiary
- **Warn Amber** (`#F59E0B`): Due and overdue bills. Appears only in the bills notification bar. Tint: `rgba(245,158,11,0.13)`.
- **Loan Orange** (`#FB923C`): Outstanding loans and interest amounts. A warm complement to the cool accent; kept separate from Warn Amber in both hue and financial context. Tint: `rgba(251,146,60,0.13)`.

### Neutral
- **Abyss** (`#000000`): Page background. Literal pixel-off on AMOLED.
- **Surface** (`#0D0D0D`): Cards, list row base, bottom tab bar, sidebar panel — the first lift from the void.
- **Surface Up** (`#161616`): Elevated surfaces: modal body, text inputs, chip backgrounds, dropdown panels.
- **Surface High** (`#1E1E1E`): Top surface: active press states, table column headers.
- **Border** (`#202020`): Card outlines, input borders, horizontal dividers. No blue or warm cast.
- **Border Faint** (`#111111`): Hairline row separators. Perceptible on AMOLED; invisible on standard LCD.
- **Ink** (`#EEF2FF`): Primary text. Near-white with a 267° blue tint that harmonizes with Precision Indigo without fighting it.
- **Ink Secondary** (`#8895B3`): Secondary text: dates, metadata, form labels, inactive navigation labels.
- **Ink Dim** (`#4E5A78`): Tertiary text: placeholders, inactive navigation icons, very-secondary metadata.

### Named Rules
**The One Voice Rule.** Precision Indigo occupies ≤15% of any screen. A new component that reaches for indigo as decoration rather than as action or selection is wrong; rewrite it using surface colors and borders.

**The Semantic Contract.** Each hue owns exactly one financial meaning: green = income, red = expense, violet = transfer, amber = due-bill warning, orange = loan. Using any of these colors outside their assigned meaning — even subtly, even for a related feature — breaks the mental model the user built on screen one.

## 3. Typography

**Body Font:** System-native sans (system-ui, -apple-system, Roboto on Android, SF Pro on iOS/macOS)
**Mono Font:** None — amounts format as locale strings, not monospaced columns

**Character:** One family, differentiated by weight alone. The system font stack arrives pre-loaded, pre-hinted for the screen's subpixel grid, and pre-familiar to the user. No custom face competes with the numbers for attention, and no font loading delay splits the first render.

### Hierarchy
- **Display** (800 weight, 34px, 1.1 line-height, −0.5px letter-spacing): Balance totals in the summary card. The single largest text on screen. Reserved strictly for amounts.
- **Headline** (800 weight, 28px, 1.15, −0.3px): Major section totals in the stats screen. Used sparingly; one per view at most.
- **Title** (700 weight, 20px, 1.3): Sheet titles, modal headers. Marks a change of context without shouting.
- **Body** (15px, 1.5 line-height): Transaction descriptions at 600 weight (primary), subtitles and metadata at 400 weight. The primary reading size throughout the transaction list.
- **Label** (600 weight, 13px, 0.1px letter-spacing): Form field labels, tab bar labels, chip text, category names in secondary positions.
- **Caption** (500 weight, 11px, 0.3px letter-spacing): Summary card column headers ("INGRESOS", "SALDO", "GASTOS"). Uppercase is permitted here and only here: three-word financial column headers at this size with this tracking, never in flowing text.

### Named Rules
**The Data-First Rule.** 800 weight is reserved for monetary amounts. No heading, label, or UI string may use 800 weight unless it is a number representing money or a derived financial figure.

**The Single Family Rule.** Adding a second font family is prohibited. The typeface decision is already made. Display faces, serif accents, and custom fonts all compete with the numbers; the numbers must win.

## 4. Elevation

Segato uses **tonal layering as structure, shadow as exception**. The four-step background stack (`#000000` → `#0D0D0D` → `#161616` → `#1E1E1E`) creates visual hierarchy through luminance alone. On AMOLED, a drop shadow on a black surface is invisible — the system doesn't pretend otherwise.

The one exception is the FAB, which carries an accent glow shadow (`shadowColor: #5B7CF6, opacity: 0.35, offset: 0 4, radius: 12`). This shadow is structural: it anchors the primary action above the scrolling list and signals its elevated permanence. It is the only colored shadow in the system.

### Shadow Vocabulary
- **Ambient Low** (`shadowColor: #000, opacity: 0.30, offset: 0 2, radius: 4, elevation: 3`): Subtle lift for surfaces that need differentiation in non-AMOLED rendering contexts (web, Electron on light-mode OS).
- **Ambient Mid** (`shadowColor: #000, opacity: 0.40, offset: 0 4, radius: 8, elevation: 6`): Heavier ambient for dialogs and sheets in intermediate contexts.
- **Accent Glow** (`shadowColor: #5B7CF6, opacity: 0.35, offset: 0 4, radius: 12, elevation: 8`): FAB only. The sole instance of a hued shadow. Reinforces that the FAB is the primary action, not a decoration.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Tonal layering conveys structure; shadows convey state or exception. A shadow on a resting surface card or row is a design error, not a depth cue.

## 5. Components

### Buttons
Two variants; that is the complete vocabulary. Firm and direct: press feedback is an immediate background shift, no hover delay, no spring animation.

- **Shape:** Gently curved (10px radius — `R.sm`)
- **Save / Primary:** Precision Indigo background (`#5B7CF6`), Ink text (`#EEF2FF`), 14px vertical / 20px horizontal padding. Pressed: `#4A68DC`. Full-width in sheet footers, always paired with Cancel.
- **Cancel / Secondary:** Surface Up background (`#161616`), Ink Secondary text (`#8895B3`). Same shape and padding. Signals reversibility without visual competition.

### Chips
Two chip types with distinct shape and behavioral context.

- **Type Chips (expense / income / transfer):** 10px radius. At rest: transparent background, 1.5px Border outline (`#202020`), Ink Secondary text (`#8895B3`). Active: semantic color at 13–22% opacity for background, full semantic color for border, semantic color text at 700 weight. Fills the full width of the row as three equal cells.
- **Tag Chips:** Pill-shaped (999px full radius), 7px vertical / 12px horizontal padding. Same rest state as type chips. Active: category-assigned color for background tint, border, and text — all at the same proportions as type chips. Applied below the form as a compact filter row.

### Cards / Containers
- **Summary Card:** Surface background (`#0D0D0D`), 14px radius, 1px Border outline (`#202020`), 16px padding. Three-column horizontal flex: income | balance | expense. Column dividers are 1px × 36px Border lines. Balance column uses Display type (34px 800 weight); flanking columns use 17px 700 weight amounts.
- **Modal Sheet:** Surface background, 24px top-left and top-right radius, 1px top Border. On desktop/Electron: full 24px radius all corners, 720px max-width, centered, 32px bottom margin and 1px full border. A 36×4px pill handle (`#202020`) centers above the title.
- **Dropdown Sheet:** Same as Modal Sheet, 62% max-height. Opens via a bottom slide-up animation.
- **Warning Bar:** `rgba(245,158,11,0.13)` background, 10px radius, 1px `rgba(245,158,11,0.27)` border. Warn Amber icon (14px) and text. Horizontally scrollable content for multiple due bills.

### Inputs / Fields
- **Style:** Surface Up background (`#161616`), 1px Border (`#202020`), 10px radius, 14px horizontal / 12px vertical padding, 15px body text.
- **Placeholder:** Ink Dim (`#4E5A78`).
- **Focus:** Border color shifts to Precision Indigo (`#5B7CF6`) — color alone signals focus, no glow or box-shadow spread.
- **Textarea variant:** 80px fixed height, top-aligned text.
- **Error:** Deficit Red border (`#F64458`). No background shift; the border change carries the state.

### Navigation
Two structural forms, never simultaneous.

- **Mobile bottom tab bar:** Surface background (`#0D0D0D`), 1px top Border, 56px Android / 50px + safe-area iOS. Tab label: 11px 600 weight. Active tab: Precision Indigo icon and label. Active icon inside a 42×30px rounded-15 pill with `rgba(91,124,246,0.15)` fill. Inactive: Ink Dim icon and label.
- **Desktop left sidebar (≥1024px):** 220px wide, Surface background, 1px right Border. Brand mark: 34×34px, 6px radius, `rgba(91,124,246,0.15)` fill, `rgba(91,124,246,0.27)` border, the letter "C" in Precision Indigo at 900 weight and 17px. App name "Chiro" beside it at 17px 800 weight Ink. Nav items: full-width pressable, 10px radius, 11px vertical padding, 12px horizontal. Active state: `rgba(91,124,246,0.15)` background, Precision Indigo icon and text (700 weight), a 3px × inset-4px rounded bar at the right edge in Precision Indigo. Inactive: transparent background, Ink Dim icon and text (500 weight).

### Transaction Row (Signature Component)
The primary content unit. Horizontal flex: avatar + body + amount.

- **Avatar:** 40×40px, 10px radius. Background is the category's assigned color at 13% opacity. Initial letter of category name or description at 15px 700 weight in the full category color.
- **Body:** Description at 15px 600 weight Ink; metadata line at 13px Ink Secondary (date, or "From → To" for transfers).
- **Amount:** Right-aligned, 17px 700 weight, semantic color (green income, red expense, violet transfer, orange loan). Negative amounts show a leading minus; positive show a leading plus for income. A sub-line in Ink Dim (11px) shows the interest-adjusted total for outstanding loans.
- **Press state:** Background shifts instantly to Surface High (`#1E1E1E`). No delay, no animation.
- **Row separator:** Hairline Border Faint (`#111111`) bottom border.

### Dropdown
- **Trigger:** Input style — Surface Up background, Border, 10px radius, trailing Ink Dim chevron. Placeholder in Ink Dim; selected label in Ink.
- **Options panel:** Bottom sheet (same as Modal Sheet). 15px vertical row padding, 4px horizontal padding per option. Selected item: Precision Indigo text at 700 weight plus trailing checkmark. Hairline Border Faint separators between items.

### Floating Action Button
- **Shape:** Circle (58×58px, 999px radius)
- **Color:** Precision Indigo background (`#5B7CF6`), white icon (26px `add-outline`)
- **Shadow:** Accent Glow — the one colored shadow in the system
- **Position:** Fixed bottom-right at 20px from edges on mobile; 32px on desktop/tablet. Bottom-of-stack z-position above the list content.

## 6. Do's and Don'ts

### Do:
- **Do** use Precision Indigo (`#5B7CF6`) only for primary actions, active navigation, and selection. Its rarity is its authority — one thing active at a time.
- **Do** apply semantic colors (green, red, violet, amber, orange) strictly to their assigned financial meanings. Never repurpose one for a new UI pattern that isn't that financial type.
- **Do** keep `#000000` as the page background on every screen. Tonal lift belongs to surfaces placed above it.
- **Do** use 800 font weight only for monetary amounts. Structural headings use 700 at most.
- **Do** use the four-step surface ramp (`#000000` → `#0D0D0D` → `#161616` → `#1E1E1E`) for all depth. A fifth value or an off-ramp hex is a design error.
- **Do** add the Accent Glow shadow (`#5B7CF6` at 35%) to the FAB only. It is the only colored shadow in the system.
- **Do** shift press state to Surface High (`#1E1E1E`) instantly with no transition delay on list rows.
- **Do** use `rgba(color, 0.13–0.15)` for semantic color background tints. The transparency preserves the AMOLED canvas beneath the tint.
- **Do** use the sidebar on desktop (≥1024px) and the bottom tab bar on mobile. Never mix the two patterns on one screen size.

### Don't:
- **Don't** use Precision Indigo as a decorative fill, background wash, or illustration element. If something is reaching for indigo for style rather than function, it is wrong.
- **Don't** use gradient text (`background-clip: text` with a gradient). All amounts and labels use a single solid color.
- **Don't** use `border-left` or `border-right` wider than 1px as a colored accent stripe on any card, row, or callout. Use full borders, background tints, or leading icons instead.
- **Don't** add glassmorphism (`backdrop-filter: blur`) decoratively. On a true-black canvas, blur is invisible; on a light surface (Electron on a light-mode OS), it reads as accidental.
- **Don't** build a hero-metric layout: large number, small label, supporting stats in a grid, gradient accent. This is the SaaS dashboard pattern that Segato explicitly rejects.
- **Don't** imitate Mint or Intuit: no notification badges competing for attention, no congratulatory copy for routine financial events, no promotional content within the transaction flow.
- **Don't** imitate banking apps: no cold institutional palettes, no excessive whitespace between functional elements, no generic iconography that could belong to any financial product.
- **Don't** imitate neon crypto wallets: no purple-to-cyan gradients, no glowing text or borders, no glass cards over colorful backgrounds.
- **Don't** add a second font family. The system font stack is the typeface decision. Display faces and custom fonts compete with the numbers; the numbers must win.
- **Don't** use Warn Amber or Loan Orange outside their defined financial contexts. If an element needs a visual highlight, use Surface High and a border — not a semantic color pressed into non-semantic service.
- **Don't** introduce a fifth depth level or an off-ramp surface color. If something needs more prominence than Surface High (`#1E1E1E`) provides, rethink the information hierarchy rather than adding a new surface value.
