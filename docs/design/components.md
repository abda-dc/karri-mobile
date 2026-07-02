# Components

All v1 components are in `apps/mobile/src/components`.

## Screen

Use `Screen` at the root of every route. It provides safe-area edges, keyboard avoidance, scroll behavior, horizontal padding, and a bounded content width. Set `withTabBar` for tab routes and `centered` for short onboarding screens.

## Card

Use cards to group information with one shared purpose.

- `outlined`: default content grouping.
- `elevated`: important summary, saved record, or focused form surface.
- `soft`: welcome, education, or gentle emphasis.

Do not nest several cards merely to add borders. Use spacing and section headings inside a card first.

## TextField

Every field has a visible label. Use `required` to expose required state, `helperText` for guidance, and `errorText` for field-specific validation. Multiline inputs receive a larger writing area automatically.

Screens retain form state and business validation; `TextField` owns only focus, presentation, and native input props.

## PrimaryButton

Buttons support `primary`, `secondary`, and `ghost` variants plus loading and disabled states. Loading disables repeat taps and exposes busy accessibility state. A card or section should usually have one primary action.

## Banner

Use banners for information that persists until the context changes:

- `development`: missing configuration or explicitly unfinished MVP behavior.
- `info`: limitations or explanatory scope.
- `success`: confirmed completion.
- `warning`: caution before proceeding.
- `error`: a failed operation or blocked state.

Development details belong in compact banners, not the main hero.

## Badge

Badges are short metadata such as package category, weight, date, or product context. They do not represent workflow state and should not contain sentences.

## StatusChip

Status chips combine a dot, label, and semantic tone. Use them for active records, counts, planned states, and process status. Do not use an active chip to imply verification.

## TrustBadge

Trust badges explain a trust-centered design idea such as “Exact corridor” or “Clarity builds trust.” They never certify a person, route, package, or handoff. Include supporting detail when the label could otherwise be misunderstood.

## EmptyState

Empty states explain why nothing is shown and offer one next action when available. Use friendly domain language, not backend terms like “no records.”

## SectionHeader

Use section headers for hierarchy within a screen or card. An eyebrow gives context, the title names the task, the subtitle explains it, and the action slot holds only compact actions or status.

## Operational booking components

Milestone 8 Phase 2 adds composed components under `src/presentation/components`:

- `BookingStatusCard`: booking/request state, participant roles, and the signed-in participant's identity badge.
- `ShipmentStatusCard`: route, package, trip, listing state, and booking-derived operational status.
- `CustodySummaryCard`: latest canonical custody event and plain-language responsibility summary.
- `ShipmentTimelineCard`: oldest-to-newest shipment history projected from custody.
- `ActivityFeed`: newest-first booking, shipment, custody, identity, trust, and in-app notification activity.
- `TimelineEventRow`: shared icon, title, explanation, time, and optional actor layout.
- `NextActionCard`: role-aware guidance derived from booking state; it does not authorize commands.

Keep trust compact inside the operational flow. Identity badges display only self-readable verification state, and trust summaries must preserve the evidence scope returned by the application service.
