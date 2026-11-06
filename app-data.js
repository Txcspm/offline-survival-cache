/* Original reference text retained verbatim as unreviewed legacy content. */
const DIVISIONS = [
  [
    "Survival & Emergency Medicine",
    [
      "Emergency Survival & Decision Making",
      "Medical Care & First Aid",
      "Shelter & Environmental Protection",
      "Water Collection & Treatment",
    ],
  ],
  [
    "Food, Agriculture & Natural Resources",
    [
      "Food & Nutrition",
      "Agriculture & Gardening",
      "Animal Husbandry & Fisheries",
      "Wilderness Skills & Natural Resources",
    ],
  ],
  [
    "Infrastructure & Engineering",
    [
      "Power Generation & Electricity",
      "Construction & Structural Repair",
      "Mechanical Systems & Fabrication",
      "Water, Waste & Public Sanitation",
      "Fire, Heating & Cooking Systems",
    ],
  ],
  [
    "Communications, Computing & Knowledge",
    [
      "Radio & Emergency Communications",
      "Computing & Offline Information Systems",
      "Mathematics, Science & Measurement",
      "Knowledge Preservation & Education",
    ],
  ],
  [
    "Movement, Navigation & Security",
    [
      "Navigation & Cartography",
      "Transportation & Vehicle Maintenance",
      "Security & Personal Safety",
    ],
  ],
  [
    "Disaster Response & Community Operations",
    [
      "Natural Disasters & Environmental Hazards",
      "Emergency Management & Community Response",
      "Family & Household Continuity",
      "Psychological Resilience & Group Dynamics",
    ],
  ],
  [
    "Long Term Community Sustainability",
    [
      "Community Organization & Governance",
      "Trade, Logistics & Resource Management",
      "Environmental Stewardship & Resource Renewal",
    ],
  ],
  [
    "Reference & Field Operations",
    [
      "Survival Reference Encyclopedia",
      "Field Tools, Calculators & Forms",
      "Practical Skills & Training Curriculum",
    ],
  ],
];

const LEGACY_ARTICLES = [
  {
    id: "OSC-0001",
    title: "Emergency Situation Assessment",
    category: "Emergency Survival & Decision Making",
    priority: "P0",
    summary: "A general framework for assessing an unfamiliar emergency.",
    body: [
      "Identify immediate threats to life, including fire, flooding, unstable structures, and dangerous environmental conditions.",
      "Move away from immediate hazards when it is safe to do so.",
      "Determine whether emergency services can be contacted and follow official instructions when available.",
      "Account for people in your group and identify urgent medical needs.",
      "Record your location, available supplies, communications options, and changing conditions.",
      "Reassess conditions regularly. Avoid unnecessary movement into hazardous areas.",
    ],
  },
  {
    id: "OSC-0002",
    title: "Household Emergency Information",
    category: "Family & Household Continuity",
    priority: "P1",
    summary:
      "Organize information that may be needed during an evacuation or extended disruption.",
    body: [
      "Record emergency contacts and designated meeting locations.",
      "Maintain accessible copies of important documents using appropriate privacy protections.",
      "Document household medical equipment, accessibility needs, and essential supplies.",
      "Identify evacuation transportation options and alternative routes.",
      "Keep printed information available in case electronic devices become unavailable.",
      "Review and update household information periodically.",
    ],
  },
  {
    id: "OSC-0003",
    title: "Emergency Communications Planning",
    category: "Radio & Emergency Communications",
    priority: "P1",
    summary:
      "Create a basic communications plan with multiple ways to exchange information.",
    body: [
      "Identify available communications methods, including cellular, radio, and in person messaging.",
      "Record important contact information and agreed reporting procedures.",
      "Plan alternatives for power outages and network disruptions.",
      "Test communications equipment and charging arrangements before an emergency.",
      "Follow applicable radio licensing and operating requirements.",
      "Use concise, accurate messages and record important information.",
    ],
  },
];
