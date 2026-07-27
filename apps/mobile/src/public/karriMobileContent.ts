export const KARRI_MOBILE_PATH = "/karri-mobile";
export const KARRI_MOBILE_TITLE = "Karri Mobile | Community Shipping for Senders and Travelers";
export const KARRI_MOBILE_DESCRIPTION =
  "Karri Mobile helps senders and travelers coordinate community shipping with clear routes, booking requests, custody expectations, alerts, and status updates.";

export const HOW_KARRI_WORKS = [
  {
    title: "Create a shipment listing",
    body: "A sender describes what needs to move, the route, timing, and package details.",
  },
  {
    title: "Publish an upcoming trip",
    body: "A traveler shares their route, travel dates, and available capacity.",
  },
  {
    title: "Discover compatible routes",
    body: "Karri helps surface listings whose origins, destinations, timing, and capacity may line up.",
  },
  {
    title: "Create a booking request",
    body: "A sender can request a booking so both people can review the proposed journey.",
  },
  {
    title: "Coordinate and follow updates",
    body: "Both parties agree on the handoff, understand custody expectations, and follow booking status updates.",
  },
] as const;

export const KARRI_FEATURES = [
  {
    icon: "cube-outline",
    title: "Clear shipment details",
    body: "Describe package category, weight, route, timing, and other details a traveler needs to review.",
  },
  {
    icon: "airplane-outline",
    title: "Route and capacity information",
    body: "Travelers can publish an upcoming route, travel dates, and the capacity they are comfortable offering.",
  },
  {
    icon: "git-compare-outline",
    title: "Compatible route discovery",
    body: "Compare shipment and travel listings when key route and timing details may be compatible.",
  },
  {
    icon: "document-text-outline",
    title: "Booking request management",
    body: "Create and review requests while keeping the proposed shipment and trip connected.",
  },
  {
    icon: "navigate-circle-outline",
    title: "Booking status tracking",
    body: "Follow clear status information as a proposed booking moves through its coordination steps.",
  },
  {
    icon: "notifications-outline",
    title: "Alerts and notifications",
    body: "Receive timely updates when relevant booking or shipment activity needs attention.",
  },
  {
    icon: "person-circle-outline",
    title: "User profiles",
    body: "Share useful profile context while remembering that profile completion does not verify identity.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Custody and handoff expectations",
    body: "Keep responsibility clearer by agreeing on when, where, and how each handoff should happen.",
  },
] as const;

export const SAFETY_REMINDERS = [
  "Verify package contents before accepting or handing over a package.",
  "Confirm the airline requirements that apply to the full route.",
  "Confirm customs requirements for every relevant country and border.",
  "Avoid prohibited or restricted items.",
  "Agree clearly on custody, timing, and handoff details.",
] as const;

export const FAQ_PREVIEW = [
  {
    question: "What is Karri Mobile?",
    answer: "Karri is a peer-to-peer coordination app for senders and travelers using community shipping routes.",
  },
  {
    question: "Who can use Karri?",
    answer: "Karri is designed for adults who want to list a shipment, publish a trip, or coordinate a possible route match.",
  },
  {
    question: "Does Karri process payments?",
    answer: "No. Karri does not currently process payments.",
  },
  {
    question: "Does Karri guarantee delivery?",
    answer: "No. Karri helps people coordinate, but it does not guarantee delivery or a successful outcome.",
  },
  {
    question: "Who is responsible for airline and customs rules?",
    answer: "Senders and travelers remain responsible for applicable laws, customs requirements, airline rules, and package restrictions.",
  },
] as const;

export const KARRI_MOBILE_REQUIRED_LINKS = [
  "/about",
  "/safety",
  "/trust-center",
  "/faq",
  "/support",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  "/delete-account",
] as const;
