export type PublicRoute =
  | "/"
  | "/about"
  | "/trust-center"
  | "/privacy-policy"
  | "/terms-of-service"
  | "/safety"
  | "/prohibited-items"
  | "/community-guidelines"
  | "/faq"
  | "/release-notes"
  | "/support"
  | "/contact"
  | "/press"
  | "/careers";

export type PublicSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type PublicPageContent = {
  path: PublicRoute;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  updated?: string;
  sections: PublicSection[];
  related: PublicRoute[];
};

export const PUBLIC_SITE_URL = "https://nice-ground-08f721010.7.azurestaticapps.net";
export const SUPPORT_EMAIL = "hello@aptopsagency.com";

export const publicPages: Record<Exclude<PublicRoute, "/">, PublicPageContent> = {
  "/about": {
    path: "/about",
    title: "About Karri",
    description: "Learn how Karri helps senders and travelers coordinate community shipping with clarity and shared responsibility.",
    eyebrow: "About Karri",
    heading: "Community shipping, made clearer",
    intro: "Karri helps senders and travelers coordinate personal package delivery along routes people are already traveling.",
    sections: [
      { id: "mission", title: "Our mission", paragraphs: ["Our mission is to make community shipping feel clearer, calmer, and more accountable. Karri helps people describe a route, understand a package, compare possible matches, and keep a shared record of what happens next."] },
      { id: "how-it-works", title: "How Karri works", bullets: ["Senders describe a non-prohibited package, route, and delivery window.", "Travelers share their route and available capacity.", "Karri helps people discover possible matches and coordinate a booking.", "Participants use status and custody records to keep the journey understandable."] },
      { id: "trust", title: "Trust without overclaiming", paragraphs: ["Karri provides decision support, not a guarantee of identity, safety, legality, delivery, or a successful transaction. People remain responsible for checking package contents, following laws and carrier rules, and deciding whether a match is right for them."], bullets: ["Clear explanations instead of opaque promises.", "Mutual responsibility instead of artificial urgency.", "Privacy-minded records instead of unnecessary personal data.", "Corridor-by-corridor readiness instead of unsupported expansion."] },
      { id: "company", title: "The company", paragraphs: ["Karri is a product of M7SK Technologies. We are building for diaspora communities and the real coordination needs that connect families, friends, and local networks across borders."] },
    ],
    related: ["/trust-center", "/community-guidelines", "/contact"],
  },
  "/trust-center": {
    path: "/trust-center",
    title: "Trust Center",
    description: "Karri's central hub for privacy, terms, safety, prohibited items, community standards, support, and contact information.",
    eyebrow: "Trust Center",
    heading: "Clear policies. Shared responsibility.",
    intro: "Use this hub to understand Karri's policies, safety expectations, community standards, and ways to get help.",
    sections: [
      { id: "privacy", title: "Privacy Policy", paragraphs: ["Understand what information Karri handles, why it is used, and the choices available to you."] },
      { id: "terms", title: "Terms of Service", paragraphs: ["Review the rules that apply when you access or use Karri."] },
      { id: "safety", title: "Safety Policy", paragraphs: ["Learn the precautions and shared responsibilities that support safer community shipping."] },
      { id: "items", title: "Prohibited Items Policy", paragraphs: ["Check what must never be offered, accepted, carried, or delivered through Karri."] },
      { id: "community", title: "Community Guidelines", paragraphs: ["See the conduct we expect from every sender, traveler, and community member."] },
      { id: "help", title: "Support and contact", paragraphs: ["Find self-service guidance, ask a question, or report a safety or policy concern."] },
    ],
    related: ["/privacy-policy", "/terms-of-service", "/safety", "/prohibited-items", "/community-guidelines", "/support", "/contact"],
  },
  "/privacy-policy": {
    path: "/privacy-policy",
    title: "Privacy Policy",
    description: "Read how Karri collects, uses, shares, protects, retains, and deletes personal information.",
    eyebrow: "Legal",
    heading: "Privacy Policy",
    intro: "This policy explains how M7SK Technologies handles information when you use Karri.",
    updated: "July 15, 2026",
    sections: [
      { id: "scope", title: "1. Scope", paragraphs: ["This Privacy Policy applies to Karri's mobile applications, websites, support channels, and related services. It does not govern third-party services that have their own privacy policies."] },
      { id: "information", title: "2. Information we collect", bullets: ["Account and profile information, such as your name, contact details, profile details, and account identifiers.", "Shipment, trip, booking, route, package-category, timing, status, custody, review, and communication information you choose to provide.", "Trust and verification status or metadata when those features are available. Karri does not treat a trust score as proof of identity or safety.", "Device, app, diagnostic, security, and usage information needed to operate, protect, and improve the service.", "Support requests and information you provide when you contact us."] },
      { id: "use", title: "3. How we use information", bullets: ["Provide, maintain, and improve Karri.", "Match shipment and trip details and explain possible matches.", "Support booking, status, custody, notification, review, and support workflows.", "Protect accounts, investigate misuse, enforce policies, and comply with law.", "Communicate about service activity, policy updates, support, and security.", "Measure reliability and understand product performance using privacy-minded data."] },
      { id: "sharing", title: "4. How information is shared", paragraphs: ["We share information only as needed to operate Karri, complete a user-requested interaction, protect the service, or comply with law."], bullets: ["With other participants when needed to evaluate a possible match or coordinate a booking.", "With service providers that host, secure, analyze, or support Karri under appropriate contractual restrictions.", "With authorities or others when reasonably necessary to comply with law, protect rights and safety, or investigate prohibited conduct.", "As part of a merger, financing, acquisition, reorganization, or sale, subject to applicable safeguards.", "With your direction or consent."] },
      { id: "retention", title: "5. Retention", paragraphs: ["We retain information for as long as reasonably necessary to provide the service, maintain security and records, resolve disputes, enforce agreements, and meet legal obligations. Retention periods vary by data type, account state, and legal context. We delete or de-identify information when it is no longer needed, unless law requires or permits longer retention."] },
      { id: "choices", title: "6. Your choices and rights", bullets: ["Review and update available account or profile information.", "Manage notification permissions through Karri and your device settings.", "Request access, correction, deletion, or a copy of eligible personal information.", "Object to or restrict certain processing where applicable.", "Withdraw consent where processing relies on consent.", "Appeal or complain to a data protection authority where applicable."] },
      { id: "security", title: "7. Security", paragraphs: ["We use administrative, technical, and organizational safeguards designed to protect information. No service can guarantee absolute security. Keep your account access secure and contact us if you believe your account or information may be at risk."] },
      { id: "children", title: "8. Children", paragraphs: ["Karri is not directed to children under 18, and people under 18 may not create an account or use Karri. Contact us if you believe a child provided personal information."] },
      { id: "international", title: "9. International use", paragraphs: ["Karri may process information in countries other than where you live. Where required, we use appropriate safeguards for international transfers. Cross-border shipping also requires participants to follow applicable customs, aviation, postal, carrier, and local laws."] },
      { id: "changes", title: "10. Changes to this policy", paragraphs: ["We may update this policy as Karri changes. We will post the revised policy, update the effective date, and provide additional notice when required. Material changes do not silently alter an existing booking agreement."] },
      { id: "contact", title: "11. Contact", paragraphs: [`For privacy questions or requests, email ${SUPPORT_EMAIL}. We may need to verify your request before responding.`] },
    ],
    related: ["/terms-of-service", "/safety", "/contact"],
  },
  "/terms-of-service": {
    path: "/terms-of-service",
    title: "Terms of Service",
    description: "Review the terms governing access to and use of Karri's community shipping platform.",
    eyebrow: "Legal",
    heading: "Terms of Service",
    intro: "These Terms govern your access to and use of Karri, a service provided by M7SK Technologies.",
    updated: "July 15, 2026",
    sections: [
      { id: "agreement", title: "1. Agreement", paragraphs: ["By accessing or using Karri, you agree to these Terms and the policies incorporated by reference. If you do not agree, do not use Karri. If you use Karri for an organization, you represent that you have authority to bind it."] },
      { id: "eligibility", title: "2. Eligibility and accounts", bullets: ["You must be at least 18 and legally able to enter a binding agreement.", "Provide accurate information and keep it current.", "Protect your account and promptly report suspected unauthorized access.", "You are responsible for activity under your account unless applicable law provides otherwise."] },
      { id: "role", title: "3. Karri's role", paragraphs: ["Karri provides tools that help independent senders and travelers discover possible matches and coordinate community shipping. Unless expressly stated, M7SK Technologies is not a carrier, freight forwarder, postal operator, customs broker, insurer, employer, or agent of a user. Users decide whether to interact and remain responsible for their agreements, conduct, and legal obligations."] },
      { id: "responsibilities", title: "4. User responsibilities", bullets: ["Describe routes, dates, package contents, size, weight, and relevant conditions honestly.", "Inspect and decline any package you cannot lawfully or safely carry.", "Follow customs, aviation, postal, carrier, sanctions, trade, tax, and local laws.", "Obtain any required permissions, declarations, receipts, or documentation.", "Keep a clear custody record and communicate material changes promptly.", "Treat other people respectfully and follow the Community Guidelines."] },
      { id: "prohibited", title: "5. Prohibited conduct and items", paragraphs: ["You may not use Karri for illegal, dangerous, deceptive, abusive, infringing, exploitative, or unauthorized activity. Prohibited items may never be offered, accepted, carried, or delivered. The Prohibited Items Policy is part of these Terms. More restrictive law or carrier rules always control."] },
      { id: "bookings", title: "6. Matches and bookings", paragraphs: ["Matches, trust summaries, identity status, reviews, and other signals are limited decision support. They are not guarantees of identity, legality, safety, suitability, payment, delivery, or outcome. Review the details yourself before accepting a booking. A booking may create a separate agreement between participating users; Karri is not a party to that agreement unless expressly stated."] },
      { id: "content", title: "7. User content", paragraphs: ["You retain ownership of content you provide. You grant M7SK Technologies a worldwide, non-exclusive, royalty-free license to host, use, reproduce, adapt, display, and distribute that content only as needed to operate, protect, and improve Karri and meet legal obligations. You represent that you have the rights needed to provide the content."] },
      { id: "suspension", title: "8. Enforcement", paragraphs: ["We may limit, suspend, or terminate access; remove content; cancel platform activity; preserve evidence; or report conduct when reasonably necessary to protect users, Karri, or others, enforce these Terms, or comply with law. We may act without advance notice when risk or law requires it."] },
      { id: "availability", title: "9. Service availability", paragraphs: ["Karri may change, pause, or discontinue features or corridor availability. The service may experience errors, delays, or interruptions. We do not promise that every feature, route, match, or participant will be available."] },
      { id: "disclaimers", title: "10. Disclaimers", paragraphs: ["To the maximum extent permitted by law, Karri is provided \"as is\" and \"as available.\" M7SK Technologies disclaims implied warranties, including merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that users, packages, routes, information, or outcomes are safe, lawful, accurate, reliable, or suitable."] },
      { id: "liability", title: "11. Limitation of liability", paragraphs: ["To the maximum extent permitted by law, M7SK Technologies and its affiliates will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, data, goodwill, or opportunities arising from Karri or user interactions. Nothing in these Terms excludes liability that cannot legally be excluded."] },
      { id: "changes", title: "12. Changes and general terms", paragraphs: ["We may update these Terms and will post the revised version with a new effective date. Material changes will receive additional notice where required. If any provision is unenforceable, the remaining provisions continue. Failure to enforce a provision is not a waiver. You may not transfer these Terms without our consent; we may transfer them as part of a corporate transaction."] },
      { id: "contact", title: "13. Contact", paragraphs: [`Questions about these Terms may be sent to ${SUPPORT_EMAIL}.`] },
    ],
    related: ["/privacy-policy", "/safety", "/prohibited-items", "/community-guidelines"],
  },
  "/safety": {
    path: "/safety",
    title: "Safety Policy",
    description: "Learn the precautions and shared responsibilities for safer community shipping with Karri.",
    eyebrow: "Trust & safety",
    heading: "Safety is a shared responsibility",
    intro: "Karri supports clearer decisions and records, but no platform signal replaces careful judgment, inspection, or compliance with law.",
    updated: "July 15, 2026",
    sections: [
      { id: "before", title: "Before a booking", bullets: ["Use accurate profile, route, timing, capacity, and package information.", "Ask questions when contents, ownership, destination, or handoff details are unclear.", "Do not rely on a score, badge, review, or verification status as a safety guarantee.", "Decline any request that feels rushed, secretive, inconsistent, illegal, or unsafe."] },
      { id: "packages", title: "Package safety", bullets: ["Senders must disclose the complete contents and relevant handling needs.", "Travelers should personally inspect contents before accepting custody where lawful and appropriate.", "Never accept a sealed or hidden package you cannot inspect or understand.", "Do not carry prohibited, illegal, dangerous, undeclared, or restricted items.", "Follow airline, airport, customs, border, postal, and local rules even if Karri allows a category."] },
      { id: "handoff", title: "Handoffs and custody", bullets: ["Meet in a safe, appropriate place and tell someone you trust about the plan.", "Confirm the other participant and package details before transfer.", "Record custody changes accurately and do not mark a step complete before it happens.", "Do not leave packages unattended or transfer them to an unapproved person."] },
      { id: "concerns", title: "When something is wrong", paragraphs: ["Stop the interaction if you suspect danger, deception, prohibited contents, coercion, trafficking, theft, fraud, or other unlawful conduct. Do not take custody. If custody has already transferred, prioritize immediate safety and follow lawful instructions from the relevant carrier, airport, customs, or emergency authority."], bullets: ["For imminent danger, contact local emergency services.", "For airport, customs, or carrier issues, contact the relevant authority directly.", `Report the concern to Karri at ${SUPPORT_EMAIL}.`, "Preserve relevant messages and records without putting yourself at risk."] },
      { id: "limits", title: "What Karri does not guarantee", paragraphs: ["Karri does not guarantee a person's identity, intentions, legal status, route, package contents, compliance, custody, delivery, or safety. Platform controls reduce some uncertainty; they do not eliminate risk."] },
    ],
    related: ["/prohibited-items", "/community-guidelines", "/support", "/contact"],
  },
  "/prohibited-items": {
    path: "/prohibited-items",
    title: "Prohibited Items Policy",
    description: "Review items that must not be offered, accepted, carried, or delivered through Karri.",
    eyebrow: "Trust & safety",
    heading: "Prohibited Items Policy",
    intro: "Never use Karri to offer, accept, carry, or deliver an item that is illegal, dangerous, hidden, undeclared, or prohibited by this policy.",
    updated: "July 15, 2026",
    sections: [
      { id: "always", title: "Always prohibited", bullets: ["Weapons, firearms, ammunition, explosives, incendiary devices, or weapon parts.", "Illegal drugs, controlled substances without lawful authorization, drug paraphernalia, or substances represented as illegal drugs.", "Hazardous, toxic, corrosive, radioactive, infectious, flammable, pressurized, or otherwise dangerous materials.", "Human remains, body parts, blood, organs, tissues, or biological specimens.", "Live animals, protected wildlife, endangered species, or unlawfully sourced animal products.", "Stolen, counterfeit, fraudulent, pirated, sanctioned, embargoed, or illegally traded goods.", "Cash, bearer instruments, money orders, transferable securities, or items primarily intended to move untraceable value.", "Illegal pornography, sexual exploitation material, or any content involving the abuse or exploitation of children.", "Items used to facilitate violence, terrorism, trafficking, smuggling, fraud, surveillance abuse, or other criminal activity.", "Any item hidden from the traveler, falsely described, undeclared, or packaged to avoid inspection or lawful controls."] },
      { id: "restricted", title: "Restricted or commonly regulated items", paragraphs: ["The following may be prohibited by law, airline, airport, customs, postal, carrier, or corridor rules even when not categorically banned by Karri. Do not proceed unless every applicable rule clearly permits the item."], bullets: ["Alcohol, tobacco, nicotine, cannabis, medicines, medical devices, and supplements.", "Food, plants, seeds, soil, agricultural products, and animal products.", "Lithium batteries, electronics with batteries, magnets, aerosols, perfumes, cosmetics, and liquids.", "High-value jewelry, precious metals, collectibles, identity documents, keys, and sensitive records.", "Cultural property, antiques, fossils, and items subject to export controls.", "Commercial quantities, goods for resale, or items requiring licenses, duties, or formal import/export declarations."] },
      { id: "responsibility", title: "Your responsibility", bullets: ["Senders must fully and accurately disclose contents, quantity, condition, value, and handling needs.", "Travelers must understand and inspect what they accept and may decline any item.", "Both participants must independently check all applicable rules for the entire route.", "A Karri category, match, or booking does not mean an item is lawful or accepted by a carrier."] },
      { id: "report", title: "Decline and report", paragraphs: [`Do not take custody of a suspicious or prohibited item. End the interaction safely and contact ${SUPPORT_EMAIL}. If there is immediate danger or suspected crime, contact local authorities or emergency services first.`] },
    ],
    related: ["/safety", "/terms-of-service", "/support"],
  },
  "/community-guidelines": {
    path: "/community-guidelines",
    title: "Community Guidelines",
    description: "Read the standards for respectful, honest, lawful, and accountable participation in the Karri community.",
    eyebrow: "Community",
    heading: "Help the community move with care",
    intro: "Everyone on Karri shares responsibility for clear communication, lawful conduct, respectful treatment, and accurate records.",
    updated: "July 15, 2026",
    sections: [
      { id: "honest", title: "Be honest and clear", bullets: ["Use accurate account, route, package, capacity, timing, and handoff information.", "Disclose material changes promptly.", "Do not impersonate someone, manipulate reviews, forge evidence, or misrepresent a platform signal."] },
      { id: "respect", title: "Treat people with respect", bullets: ["Communicate without harassment, threats, hate, discrimination, sexual misconduct, bullying, or intimidation.", "Respect boundaries and a person's decision to decline or end an interaction.", "Do not exploit another person's immigration status, language, disability, finances, or unfamiliarity with a route."] },
      { id: "privacy", title: "Protect privacy", bullets: ["Share only information needed to evaluate and coordinate the interaction.", "Do not publish, sell, scrape, or misuse another person's personal information.", "Do not record or photograph people, documents, or private locations without permission and lawful authority."] },
      { id: "safe", title: "Act safely and lawfully", bullets: ["Follow the Safety and Prohibited Items Policies.", "Never pressure someone to bypass inspection, declarations, customs, carrier, or legal requirements.", "Do not use Karri for fraud, exploitation, trafficking, violence, or any unlawful activity."] },
      { id: "records", title: "Keep the journey accountable", bullets: ["Update status and custody records only when the described event actually occurs.", "Preserve relevant information when a dispute or safety issue arises.", "Cooperate with reasonable safety, support, and lawful investigation requests."] },
      { id: "enforcement", title: "Enforcement", paragraphs: ["Karri may remove content, limit features, cancel platform activity, suspend or terminate accounts, preserve evidence, or report conduct when these guidelines or the law may have been violated. Serious or repeated violations may result in permanent removal."] },
    ],
    related: ["/safety", "/prohibited-items", "/terms-of-service", "/contact"],
  },
  "/faq": {
    path: "/faq",
    title: "Frequently Asked Questions",
    description: "Find answers about Karri accounts, matches, package safety, bookings, custody, and support.",
    eyebrow: "Help Center",
    heading: "Frequently asked questions",
    intro: "Start here for practical guidance about using Karri. Support is available if you still need help.",
    sections: [
      { id: "what", title: "What is Karri?", paragraphs: ["Karri is a community shipping platform that helps senders and travelers discover possible route matches and coordinate a package journey. Karri is not a carrier and does not guarantee a participant, package, route, or outcome."] },
      { id: "match", title: "How does matching work?", paragraphs: ["Karri compares information such as origin, destination, timing, capacity, and package category. A possible match is decision support, not approval or a safety guarantee. Review every detail before proceeding."] },
      { id: "send", title: "What can I send?", paragraphs: ["Only lawful, fully disclosed, non-prohibited items that every relevant airline, airport, customs authority, carrier, and jurisdiction permits. Review the Prohibited Items Policy and check the rules for the full route."] },
      { id: "inspect", title: "Should a traveler inspect the package?", paragraphs: ["Yes, where lawful and appropriate. Travelers should understand what they are accepting and decline sealed, hidden, inconsistent, or suspicious contents. Never accept pressure to skip inspection or declarations."] },
      { id: "trust", title: "Does a trust score or badge mean someone is verified or safe?", paragraphs: ["No. Karri trust information summarizes limited evidence to support better questions. It does not prove identity, safety, legality, reliability, or a successful delivery."] },
      { id: "custody", title: "What is a custody record?", paragraphs: ["A custody record helps participants understand who held a package and when a handoff was recorded. Update it only when the event actually happens. It does not replace legal documentation or prove that every fact is correct."] },
      { id: "problem", title: "What should I do if something feels wrong?", paragraphs: ["Stop the interaction and do not take custody. If there is immediate danger, contact local emergency services. For airport, customs, or carrier issues, contact the relevant authority. Then report the concern to Karri Support."] },
      { id: "account", title: "How do I request help with my account or data?", paragraphs: [`Email ${SUPPORT_EMAIL} with a clear description of the request. Do not send passwords, full identity documents, payment credentials, or unnecessary sensitive information.`] },
    ],
    related: ["/support", "/release-notes", "/safety", "/prohibited-items"],
  },
  "/release-notes": {
    path: "/release-notes",
    title: "Release Notes",
    description: "See what's new in Karri Mobile and review important product updates.",
    eyebrow: "Help Center",
    heading: "Release notes",
    intro: "A plain-language record of notable changes to Karri's public experience and mobile app.",
    sections: [
      { id: "v1", title: "Karri 1.0 - July 2026", paragraphs: ["Karri's first public release establishes the core community shipping experience and the public information required to use it responsibly."], bullets: ["Create shipment requests and share traveler routes.", "Discover possible exact-corridor matches with clear explanations.", "Coordinate booking decisions and view status or custody history.", "Review trust information as limited decision support.", "Use public About, Trust Center, policy, Help Center, support, and company pages.", "Access responsive navigation, improved keyboard support, semantic page structure, and route-specific search metadata."] },
      { id: "limitations", title: "Current limitations", bullets: ["Karri does not guarantee identity, safety, legality, package contents, custody, delivery, or outcome.", "Feature and corridor availability may be limited during rollout.", "Some operational and verification capabilities remain subject to readiness, policy, and regional review."] },
      { id: "help", title: "Need help after an update?", paragraphs: [`Visit Support or email ${SUPPORT_EMAIL}. Include your app version, device type, and a description of what happened, but do not send passwords or unnecessary sensitive information.`] },
    ],
    related: ["/support", "/faq", "/contact"],
  },
  "/support": {
    path: "/support",
    title: "Karri Support",
    description: "Get help with Karri accounts, shipments, trips, bookings, safety concerns, and privacy requests.",
    eyebrow: "Help Center",
    heading: "How can we help?",
    intro: "Find an answer in the FAQ or contact the Karri team for account, product, policy, privacy, or safety support.",
    sections: [
      { id: "start", title: "Start with self-service", bullets: ["Read the FAQ for common account, match, package, and custody questions.", "Check Release Notes for recent product changes.", "Review the Trust Center before sending or carrying a package."] },
      { id: "contact", title: "Contact Support", paragraphs: [`Email ${SUPPORT_EMAIL}. Describe what you were trying to do, what happened, and any safe troubleshooting steps you already tried.`], bullets: ["For account help, include the email associated with the account.", "For a booking or shipment issue, include the relevant Karri record ID if available.", "For a technical issue, include app version, device type, and screenshots with personal information removed.", "Never send a password, one-time code, full identity document, payment credential, or unnecessary package details."] },
      { id: "safety", title: "Urgent safety concerns", paragraphs: ["Karri Support is not an emergency service. If anyone is in immediate danger, contact local emergency services. For an active airport, customs, border, or carrier issue, contact the responsible authority directly, then notify Karri when it is safe to do so."] },
      { id: "reports", title: "Reports and privacy requests", paragraphs: ["Use the same support email to report prohibited conduct, appeal an account decision, or request access, correction, or deletion of eligible personal information. We may ask for reasonable information to verify the account or request."] },
    ],
    related: ["/faq", "/release-notes", "/contact", "/trust-center"],
  },
  "/contact": {
    path: "/contact",
    title: "Contact Karri",
    description: "Contact Karri for product support, safety reports, privacy requests, press, partnerships, or general questions.",
    eyebrow: "Contact",
    heading: "Talk with the Karri team",
    intro: "Choose the clearest subject for your message so it reaches the right team.",
    sections: [
      { id: "support", title: "Product and account support", paragraphs: [`Email ${SUPPORT_EMAIL} for account access, app behavior, shipment, trip, booking, or custody questions.`] },
      { id: "safety", title: "Safety and policy reports", paragraphs: [`Email ${SUPPORT_EMAIL} with "Safety report"Ã‚Â in the subject. Do not put yourself at risk to collect evidence. For immediate danger, contact local emergency services first.`] },
      { id: "privacy", title: "Privacy requests", paragraphs: [`Email ${SUPPORT_EMAIL} with "Privacy request"Ã‚Â in the subject for access, correction, deletion, or other eligible privacy requests.`] },
      { id: "press", title: "Press and company inquiries", paragraphs: [`Email ${SUPPORT_EMAIL} with "Press inquiry,"Ã‚Â "Partnership,"Ã‚Â or "Careers"Ã‚Â in the subject, as appropriate.`] },
      { id: "safe-message", title: "Send information safely", paragraphs: ["Do not email passwords, one-time codes, full payment credentials, full identity documents, or unnecessary sensitive package details. We will request additional information through an appropriate channel if it is needed."] },
    ],
    related: ["/support", "/press", "/careers", "/privacy-policy"],
  },
  "/press": {
    path: "/press",
    title: "Karri Press",
    description: "Find Karri company facts, brand context, and media contact information.",
    eyebrow: "Company",
    heading: "Karri press room",
    intro: "Company context and a direct contact for journalists, researchers, and community storytellers.",
    sections: [
      { id: "boilerplate", title: "About Karri", paragraphs: ["Karri is a community shipping platform from M7SK Technologies. It helps senders and travelers describe routes, discover possible matches, coordinate bookings, and keep package journeys clearer. Karri is built around transparency, mutual responsibility, and trust without overclaiming."] },
      { id: "facts", title: "Company facts", bullets: ["Company: M7SK Technologies.", "Product: Karri Mobile.", "Focus: community shipping coordination for diaspora corridors.", "Approach: mobile-first, corridor-aware, privacy-minded, and community-centered."] },
      { id: "media", title: "Media inquiries", paragraphs: [`Email ${SUPPORT_EMAIL} with "Press inquiry"Ã‚Â in the subject, your publication or organization, your deadline, and the topic of your request.`] },
      { id: "brand", title: "Brand use", paragraphs: ["Please request permission before using Karri or M7SK Technologies names, logos, screenshots, or product imagery in a way that could imply endorsement, partnership, or certification."] },
    ],
    related: ["/about", "/contact", "/trust-center"],
  },
  "/careers": {
    path: "/careers",
    title: "Careers at Karri",
    description: "Learn about working with Karri and M7SK Technologies to build trustworthy community shipping.",
    eyebrow: "Company",
    heading: "Build for connection and accountability",
    intro: "Karri is building careful technology for real cross-border community needs.",
    sections: [
      { id: "work", title: "Why this work matters", paragraphs: ["Community shipping already happens through family, friendship, and diaspora networks. We want to give those interactions clearer expectations, better records, and calmer tools without pretending software can remove every risk."] },
      { id: "values", title: "How we work", bullets: ["Clarity before decoration or growth claims.", "Trust grounded in evidence and visible limitations.", "Privacy, accessibility, and safety as product requirements.", "Respect for corridor-specific law, culture, and operational reality.", "Small, maintainable systems with accountable ownership."] },
      { id: "roles", title: "Open roles", paragraphs: ["There are no public openings listed at this time. We will publish roles here when they become available. Karri does not request payment, gift cards, cryptocurrency, or banking credentials from applicants."] },
      { id: "interest", title: "General interest", paragraphs: [`To introduce yourself, email ${SUPPORT_EMAIL} with "Careers"Ã‚Â in the subject. Include a short note about the problem you want to help solve and a link to relevant work. Please do not send sensitive identity or financial information.`] },
    ],
    related: ["/about", "/press", "/contact"],
  },
};

export const publicRouteLabels: Record<PublicRoute, string> = {
  "/": "Home",
  "/about": "About",
  "/trust-center": "Trust Center",
  "/privacy-policy": "Privacy Policy",
  "/terms-of-service": "Terms of Service",
  "/safety": "Safety Policy",
  "/prohibited-items": "Prohibited Items Policy",
  "/community-guidelines": "Community Guidelines",
  "/faq": "FAQ",
  "/release-notes": "Release Notes",
  "/support": "Support",
  "/contact": "Contact",
  "/press": "Press",
  "/careers": "Careers",
};
