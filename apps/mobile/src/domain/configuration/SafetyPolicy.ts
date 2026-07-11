export type PolicyRuleSourceType = "law" | "carrier_rule" | "karri_policy";

export interface PolicySource {
  readonly authority: string;
  readonly jurisdiction: string;
  readonly reference: string;
  readonly sourceType: PolicyRuleSourceType;
  readonly effectiveDate: string;
  readonly lastReviewedDate: string;
}

export interface ProhibitedCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly items: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<PolicySource>;
}

export interface SafetyPolicy {
  readonly policyVersion: string;
  readonly effectiveDate: string;
  readonly prohibitedCategories: ReadonlyArray<ProhibitedCategory>;
}

export const CURRENT_POLICY_VERSION = "2026-07-v1";
export const CURRENT_DECLARATION_VERSION = "v1";

// Default/Initial versioned policy referencing regulatory sources
export const defaultSafetyPolicy: SafetyPolicy = {
  policyVersion: CURRENT_POLICY_VERSION,
  effectiveDate: "2026-07-11",
  prohibitedCategories: [
    {
      id: "weapons_violence",
      name: "Weapons and Violence-Related Items",
      description: "Firearms, components, ammunition, explosives, replication weapons, and other offensive implements.",
      items: [
        "Firearms, frames, receivers, barrels, or key components",
        "Ammunition, magazines, shells, or gunpowder",
        "Explosives, detonators, fireworks, flares, or replica/inert grenades",
        "Stun guns, Tasers, pepper spray, or tear gas",
        "Brass knuckles, switchblades, swords, and controlled knives",
        "Realistic imitation or toy weapons"
      ],
      sources: [
        {
          authority: "TSA",
          jurisdiction: "USA",
          reference: "Prohibited Items List - Weapons & Explosives",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        },
        {
          authority: "IATA",
          jurisdiction: "Global",
          reference: "Dangerous Goods Regulations Subsection 2.3",
          sourceType: "carrier_rule",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "drugs_controlled_substances",
      name: "Illegal Drugs and Controlled Substances",
      description: "Narcotics, illegal synthetic chemicals, prescription drugs without proper documentation or packaging.",
      items: [
        "Narcotics, cannabis, marijuana, and products containing THC",
        "Prescription medicines outside their original pharmacy packaging",
        "Unlabeled pills or medications sent for other individuals without proper medical documentation",
        "Illegal synthetic drugs or anabolic steroids",
        "Khat or other route-restricted substances"
      ],
      sources: [
        {
          authority: "FDA",
          jurisdiction: "USA",
          reference: "Importation of Prescription Drugs under FD&C Act",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        },
        {
          authority: "Kenya Revenue Authority",
          jurisdiction: "Kenya",
          reference: "Customs Restricted and Prohibited Goods List",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "hazardous_materials",
      name: "Dangerous Goods and Hazardous Materials",
      description: "Flammable liquids, compressed gases, corrosive chemicals, toxins, or radioactive substances.",
      items: [
        "Gasoline, fuels, lighter fluid, and camping stoves with residue",
        "Compressed gas cylinders (butane, propane, oxygen)",
        "Corrosive acids, alkalis, bleach, and strong industrial chemicals",
        "Pesticides, toxic poisons, or biohazardous substances",
        "Unknown powders, chemical solutions, or liquids"
      ],
      sources: [
        {
          authority: "ICAO",
          jurisdiction: "Global",
          reference: "Technical Instructions for the Safe Transport of Dangerous Goods by Air",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "batteries_electronics",
      name: "Batteries and Electronic Risks",
      description: "Spare batteries and battery packs that pose flight-safety risks.",
      items: [
        "Loose or spare lithium-metal and lithium-ion batteries",
        "Power banks and battery cases",
        "Damaged, swollen, or recalled electronic devices",
        "Vaping devices and e-cigarettes in checked baggage",
        "Hoverboards, smart luggage, or self-balancing boards with non-removable batteries"
      ],
      sources: [
        {
          authority: "FAA / SafeTravels",
          jurisdiction: "USA",
          reference: "Pack Safe Aviation Guidelines - Batteries",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        },
        {
          authority: "Ethiopian Airlines",
          jurisdiction: "Ethiopia",
          reference: "Baggage Policy and Dangerous Goods Regulations",
          sourceType: "carrier_rule",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "agriculture_food",
      name: "Food, Agriculture, Plants, and Animals",
      description: "Fresh meats, soil, seeds, fresh produce, and unlabelled items subject to custom quarantine rules.",
      items: [
        "Fresh, dried, or raw meats and poultry products",
        "Soil, live plants, seeds, and untreated wood items",
        "Fresh fruits and vegetables",
        "Unlabeled, unsealed, or homemade perishable foodstuffs",
        "Veterinary biological specimens or live insects"
      ],
      sources: [
        {
          authority: "USDA APHIS",
          jurisdiction: "USA",
          reference: "Agricultural Import Restrictions Circular",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        },
        {
          authority: "Tanzania Bureau of Standards",
          jurisdiction: "Tanzania",
          reference: "Sanitary and Phytosanitary Import Regulations",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "wildlife_species",
      name: "Wildlife and Protected Species",
      description: "Ivory, rhino horns, endangered species parts, or illegal animal trophies.",
      items: [
        "Ivory, raw bone, or rhino horn products",
        "Protected animal skins, shells, or feathers",
        "Bushmeat or uncertified wildlife taxidermy",
        "CITES-controlled flora and fauna products"
      ],
      sources: [
        {
          authority: "CITES",
          jurisdiction: "Global",
          reference: "Convention on International Trade in Endangered Species Appendices I & II",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "currency_financial",
      name: "Currency and Financial Instruments",
      description: "Large amounts of cash or negotiable instruments that pose anti-money laundering and theft risks.",
      items: [
        "Cash or traveler checks exceeding $10,000 USD (or equivalent) undeclared",
        "Negotiable bearer instruments, blank checks, or money orders",
        "Uncertified high-value precious metals or loose gemstones",
        "Cryptocurrency hardware devices containing third-party assets"
      ],
      sources: [
        {
          authority: "EAC",
          jurisdiction: "East Africa",
          reference: "EAC Customs Management Act Section 23",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        },
        {
          authority: "Karri Platform",
          jurisdiction: "Global",
          reference: "Platform Anti-Theft and Fraud Protection Policy",
          sourceType: "karri_policy",
          effectiveDate: "2026-07-11",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "identity_documents",
      name: "Identity and Legal Documents",
      description: "Counterfeit or unauthorized third-party documents.",
      items: [
        "Counterfeit, forged, or altered passports/ID cards",
        "Blank government forms or official certificates",
        "SIM cards registered to other individuals where prohibited by regional law",
        "Credit or debit cards not belonging to the sender"
      ],
      sources: [
        {
          authority: "Uganda Communications Commission",
          jurisdiction: "Uganda",
          reference: "SIM Card Registration Regulation Act",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "counterfeit_sanctioned",
      name: "Counterfeit, Stolen, and Sanctioned Goods",
      description: "Items in violation of intellectual property laws, stolen goods, or sanctioned products.",
      items: [
        "Counterfeit designer clothing, electronics, or medications",
        "Stolen property or cultural artifacts lacking provenance",
        "Sanctioned or embargoed goods from restricted jurisdictions"
      ],
      sources: [
        {
          authority: "WIPO",
          jurisdiction: "Global",
          reference: "TRIPS Agreement on Intellectual Property Rights",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "human_remains_medical",
      name: "Human Remains and Medical Waste",
      description: "Human tissue, biohazardous samples, or contaminated equipment.",
      items: [
        "Human organs, tissue, blood, or diagnostic samples",
        "Medical waste, used syringes, or contaminated sharps",
        "Cremated remains unless explicitly cleared by authorized carrier carrier rules"
      ],
      sources: [
        {
          authority: "WHO",
          jurisdiction: "Global",
          reference: "Guidance on Regulations for the Transport of Infectious Substances",
          sourceType: "law",
          effectiveDate: "2026-01-01",
          lastReviewedDate: "2026-07-11"
        }
      ]
    },
    {
      id: "deceptive_packages",
      name: "High-Risk and Deceptive Packages",
      description: "Sealed or uninspectable containers, mismatching declarations, or packages constructed to bypass scrutiny.",
      items: [
        "Sealed boxes/packages where the sender refuses a pre-custody inspection",
        "Packages prepared by unknown third parties without sender validation",
        "Packages with intentional false declarations or hidden compartments",
        "Contents that differ from the digital listing description"
      ],
      sources: [
        {
          authority: "Karri Platform",
          jurisdiction: "Global",
          reference: "Traveler Safety and Verification Requirements",
          sourceType: "karri_policy",
          effectiveDate: "2026-07-11",
          lastReviewedDate: "2026-07-11"
        }
      ]
    }
  ]
};
