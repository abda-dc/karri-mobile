# Accessibility

## Baseline

Karri aims for WCAG 2.2 AA principles across mobile and web, while recognizing that compliance requires device testing, assistive-technology testing, and repeated review beyond code-level checks.

## Touch and navigation

- Interactive targets are at least 44 by 44 points; primary controls use 52 points.
- Buttons expose disabled and busy states to accessibility APIs.
- Tab labels remain visible and do not depend on icons.
- Keyboard appearance must not hide the focused field or primary form action.
- Safe-area padding protects content from notches and system UI.

## Text and contrast

- Body text starts at 16 points with 24-point line height.
- High-emphasis text uses deep forest on cream or white.
- Muted text is reserved for secondary content, not critical instructions.
- Semantic states include a text label; color is never the only signal.
- Dynamic type and font scaling should be tested on both iOS and Android before pilot release.

## Forms

- Every `TextField` has a visible label and a programmatic accessibility label.
- Required fields include a visible asterisk.
- Helper text explains format before an error occurs.
- Errors describe how to recover and remain near the relevant form section.
- Placeholder text never replaces the label.
- Numeric and date keyboards are hints, not validation boundaries.

## Loading, empty, and error states

- Loading indicators include adjacent text explaining what is happening.
- Error banners use an assertive live region.
- Empty states explain the reason and next available action.
- Disabled controls remain legible and are never the only explanation of a blocked action.

## Language and cognition

Use short sentences, familiar verbs, and one decision per primary action. Explain terms such as corridor or custody when they first appear in user-facing flows. Avoid countdowns, artificial urgency, and hidden consequences.

## Testing checklist

Before release, test:

1. VoiceOver and TalkBack traversal order.
2. External keyboard navigation on web and supported devices.
3. Large text and display zoom.
4. Color contrast in default and dim environments.
5. Form completion without relying on placeholder text.
6. Tab and screen behavior on small devices and devices with bottom insets.
