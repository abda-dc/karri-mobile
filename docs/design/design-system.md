# Design System v1

## Purpose

Karri Design System v1 gives the current Expo app one small, readable visual language. It is a code-native system: tokens and components live in `apps/mobile/src/theme` and `apps/mobile/src/components`, with no external UI library.

## Principles

1. **Clarity before decoration.** Route, status, responsibility, and next action receive the strongest hierarchy.
2. **Trust without overclaiming.** Visual confidence cannot substitute for identity or custody evidence.
3. **Calm by default.** Neutral surfaces dominate; semantic colors are reserved for meaning.
4. **Mobile comfort.** Layouts wrap on narrow screens, forms scroll with the keyboard, and controls meet touch targets.
5. **One vocabulary.** Screens compose shared primitives rather than recreating cards, fields, banners, or state treatments.

## Token source

`apps/mobile/src/theme/tokens.ts` is the source of truth.

### Typography

The system uses the platform font in eight roles: display, title, headline, subheading, body, body strong, label, caption, and overline. Platform fonts keep the foundation light and readable; a custom brand font requires a separate performance and accessibility decision.

### Spacing and radius

Spacing follows a practical 4/8-based scale from `xxs` through `huge`. Screen padding is 20 points, standard card padding is 20, and major page sections generally use 24–32.

Radii range from 10 for compact controls to 24–30 for major surfaces. Pill radius is reserved for short badges and status chips.

### Elevation

Most cards are outlined. Low elevation distinguishes important interactive or summary surfaces. Medium elevation is available but should remain rare. Shadow color uses deep forest rather than pure black for a softer result.

### Layout

- Content is centered at a maximum width of 560 for Expo web and larger devices.
- Tab screens reserve bottom content space for the tab bar.
- Route field groups wrap naturally below their minimum column width.
- `Screen` owns safe areas, keyboard avoidance, and scroll behavior.

### Touch targets

The minimum target is 44 points. Primary controls use a comfortable 52-point height, with 8 points of hit slop where appropriate.

## Semantic hierarchy

- Primary button: the one recommended next action in a surface.
- Secondary button: a valid alternative.
- Ghost button: navigation away or low-emphasis action.
- Banner: contextual system feedback that should remain visible.
- Badge: compact metadata.
- Status chip: record or process status.
- Trust badge: educational framing, never proof of verification.

## Change rule

Add a token only when at least two screens or components need the same semantic value. Add a component only when it carries a repeated interaction or meaning—not merely because two views share a temporary shape.
