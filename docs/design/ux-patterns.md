# UX Patterns

## Trust-centered hierarchy

Every Karri screen should answer three questions in order:

1. What can I do here?
2. What evidence or limitation should shape my decision?
3. What happens next?

Trust is communicated through clarity and evidence—not visual authority. “Possible match” and “Exact corridor” describe implemented facts. “Verified traveler” or “safe package” must not appear until corresponding workflows and evidence exist.

## Development Mode

Unfinished infrastructure or placeholder behavior appears in a compact sky-blue `Banner` titled **Development Mode**. It should never dominate the hero or read like production onboarding.

Use it for:

- Missing local Firebase configuration.
- Anonymous Auth bridge disclosure.
- Profile fields that are not yet persisted.

Do not use it for ordinary product empty states.

## Async state pattern

Every Firestore-backed surface supports:

- **Loading:** spinner plus specific progress text.
- **Error:** error banner with a safe message.
- **Empty:** friendly explanation and one relevant next action.
- **Success:** success banner after a confirmed write.
- **Content:** cards with status and concise metadata.

Keep existing content visible when a later design adds refresh behavior; do not blank the screen unnecessarily.

Error banners use the centralized application error message and its recovery guidance. They preserve specific validation and lifecycle-rule failures, but never display provider codes, raw exception messages, or stack details. Permission and conflict errors direct the user to refresh or sign in; network and timeout errors direct the user to check connectivity and sync state before repeating a mutation.

## Optimistic action pattern

- Show pending intent immediately, but keep it visually distinct from confirmed status.
- Disable conflicting actions while a lifecycle or custody write is pending.
- Do not create fake booking or custody records; let realtime subscriptions provide canonical records.
- On failure, remove the pending projection, retain editable input, and show the existing friendly error.
- Reconcile returned reviews by ID and notification state by record ID so listener updates do not duplicate UI.
- A queued Firestore write remains pending until its service promise settles; the offline banner explains reconnect behavior.

## Forms

Group fields by the decision they support:

- Route
- Package details or trip schedule
- Timing, capacity, and reward

Use visible labels, required markers, examples, and privacy guidance. Validate before saving, retain user input after failure, disable repeat submission while saving, and clear the form only after a successful write.

## Match cards

A match card leads with the corridor, then separates shipment and trip facts. The card may call out an exact corridor, but it must also state the current eligibility limits. It does not include a booking action in Design System v1.

## Placeholder screens

Tracking and Profile remain polished previews. They explain the intended value and current limitation without simulating live data, verification, or completed custody events.

## Banners, badges, cards, and empty states

- Use a **banner** for system feedback or a limitation that stays relevant.
- Use a **badge** for short metadata.
- Use a **status chip** for record state or compact counts.
- Use a **card** to group one coherent object or task.
- Use an **empty state** when the absence of content is the main state of the section.
- Use a **trust badge** only to explain design intent or an evidenced fact; never as decoration that implies verification.
