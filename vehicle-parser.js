// vehicle-parser.js - Dedicated vehicle title parsing with comprehensive make/model dataset
// File location: fb-extension/vehicle-parser.js

/**
 * Comprehensive Vehicle Parser
 * Parses vehicle listing titles into Year, Make, and Model components
 * Uses extensive dataset of car makes and models for accurate identification
 */

// Comprehensive car makes and their common models
const VEHICLE_DATABASE = {
  "ACURA": [
    "CL", "CSX", "EL", "ILX", "INTEGRA", "LEGEND", "MDX", "NSX", "RDX", "RL", "RLX", 
    "RSX", "SLX", "TL", "TLX", "TSX", "VIGOR", "ZDX"
  ],
  "AUDI": [
    "100", "200", "80", "90", "A1", "A3", "A4", "A5", "A6", "A7", "A8", "ALLROAD", 
    "CABRIOLET", "COUPE", "E-TRON", "Q3", "Q5", "Q7", "Q8", "QUATTRO", "R8", "RS3", 
    "RS4", "RS5", "RS6", "RS7", "S3", "S4", "S5", "S6", "S7", "S8", "SQ5", "SQ7", 
    "SQ8", "TT", "V8"
  ],
  "BMW": [
    "1 SERIES", "2 SERIES", "3 SERIES", "4 SERIES", "5 SERIES", "6 SERIES", "7 SERIES", 
    "8 SERIES", "ALPINA", "I3", "I4", "I8", "IX", "M1", "M2", "M3", "M4", "M5", "M6", 
    "M8", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z3", "Z4", "Z8"
  ],
  "BUICK": [
    "CASCADA", "CENTURY", "ELECTRA", "ENCLAVE", "ENCORE", "ENVISION", "LACROSSE", 
    "LESABRE", "LUCERNE", "PARK AVENUE", "RAINIER", "REGAL", "RENDEZVOUS", "RIVIERA", 
    "ROADMASTER", "SKYLARK", "TERRAZA", "VERANO"
  ],
  "CADILLAC": [
    "ATS", "CATERA", "CTS", "CT4", "CT5", "CT6", "DEVILLE", "DTS", "ELDORADO", 
    "ESCALADE", "EXT", "FLEETWOOD", "SEVILLE", "SRX", "STS", "XLR", "XT4", "XT5", 
    "XT6", "XTS"
  ],
  "CHEVROLET": [
    "ASTRO", "AVALANCHE", "AVEO", "BLAZER", "BOLT", "CAMARO", "CAPRICE", "CAPTIVA", 
    "CAVALIER", "COLORADO", "CORVETTE", "CRUZE", "EQUINOX", "EXPRESS", "HHR", "IMPALA", 
    "LUMINA", "MALIBU", "METRO", "MONTE CARLO", "ORLANDO", "SILVERADO", "SONIC", 
    "SPARK", "SUBURBAN", "TAHOE", "TRACKER", "TRAILBLAZER", "TRAVERSE", "TRAX", 
    "UPLANDER", "VENTURE", "VOLT"
  ],
  "CHRYSLER": [
    "200", "300", "300C", "300M", "ASPEN", "CIRRUS", "CONCORDE", "CROSSFIRE", 
    "INTREPID", "LEBARON", "LHS", "NEON", "PACIFICA", "PT CRUISER", "SEBRING", 
    "TOWN & COUNTRY", "VOYAGER"
  ],
  "DODGE": [
    "AVENGER", "CALIBER", "CARAVAN", "CHALLENGER", "CHARGER", "DART", "DURANGO", 
    "GRAND CARAVAN", "INTREPID", "JOURNEY", "MAGNUM", "NEON", "NITRO", "RAM", 
    "STEALTH", "STRATUS", "VIPER"
  ],
  "FORD": [
    "AEROSTAR", "BRONCO", "C-MAX", "CONTOUR", "CROWN VICTORIA", "E-SERIES", "ECONOLINE", 
    "EDGE", "ESCAPE", "ESCORT", "EXCURSION", "EXPEDITION", "EXPLORER", "F-150", "F-250", 
    "F-350", "F-450", "FIESTA", "FIVE HUNDRED", "FLEX", "FOCUS", "FREESTAR", "FREESTYLE", 
    "FUSION", "MUSTANG", "RANGER", "TAURUS", "THUNDERBIRD", "TRANSIT", "WINDSTAR"
  ],
  "GMC": [
    "ACADIA", "CANYON", "ENVOY", "JIMMY", "SAFARI", "SAVANA", "SIERRA", "SONOMA", 
    "SUBURBAN", "TERRAIN", "VANDURA", "YUKON"
  ],
  "HONDA": [
    "ACCORD", "CIVIC", "CLARITY", "CR-V", "CR-Z", "CROSSTOUR", "ELEMENT", "FIT", 
    "HR-V", "INSIGHT", "ODYSSEY", "PASSPORT", "PILOT", "PRELUDE", "RIDGELINE", "S2000"
  ],
  "HYUNDAI": [
    "ACCENT", "AZERA", "ELANTRA", "ENTOURAGE", "GENESIS", "IONIQ", "KONA", "NEXO", 
    "PALISADE", "SANTA FE", "SONATA", "TIBURON", "TUCSON", "VELOSTER", "VENUE", "VERACRUZ"
  ],
  "INFINITI": [
    "EX35", "EX37", "FX35", "FX37", "FX45", "FX50", "G20", "G25", "G35", "G37", 
    "I30", "I35", "J30", "JX35", "M30", "M35", "M37", "M45", "M56", "Q30", "Q40", 
    "Q45", "Q50", "Q60", "Q70", "QX30", "QX4", "QX50", "QX56", "QX60", "QX70", "QX80"
  ],
  "JAGUAR": [
    "E-PACE", "F-PACE", "F-TYPE", "I-PACE", "S-TYPE", "X-TYPE", "XE", "XF", "XJ", 
    "XJR", "XJS", "XK", "XKR"
  ],
  "JEEP": [
    "CHEROKEE", "COMMANDER", "COMPASS", "GLADIATOR", "GRAND CHEROKEE", "GRAND WAGONEER", 
    "LIBERTY", "PATRIOT", "RENEGADE", "TJ", "WAGONEER", "WRANGLER", "YJ"
  ],
  "KIA": [
    "AMANTI", "BORREGO", "CADENZA", "CARNIVAL", "FORTE", "K5", "K900", "MAGENTIS", 
    "NIRO", "OPTIMA", "RIO", "RONDO", "SEDONA", "SELTOS", "SORENTO", "SOUL", 
    "SPECTRA", "SPORTAGE", "STINGER", "TELLURIDE"
  ],
  "LAND ROVER": [
    "DEFENDER", "DISCOVERY", "DISCOVERY SPORT", "EVOQUE", "FREELANDER", "LR2", "LR3", 
    "LR4", "RANGE ROVER", "RANGE ROVER SPORT", "RANGE ROVER VELAR", "RANGE ROVER EVOQUE"
  ],
  "LEXUS": [
    "CT", "ES", "GS", "GX", "HS", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "SC", "UX"
  ],
  "LINCOLN": [
    "AVIATOR", "BLACKWOOD", "CONTINENTAL", "CORSAIR", "LS", "MARK", "MKC", "MKS", 
    "MKT", "MKX", "MKZ", "NAUTILUS", "NAVIGATOR", "TOWN CAR", "ZEPHYR"
  ],
  "MAZDA": [
    "2", "3", "5", "6", "626", "929", "B-SERIES", "CX-3", "CX-30", "CX-5", "CX-7", 
    "CX-9", "MAZDASPEED3", "MAZDASPEED6", "MILLENIA", "MIATA", "MPV", "MX-5", "PROTEGE", 
    "RX-7", "RX-8", "TRIBUTE"
  ],
  "MERCEDES-BENZ": [
    "190", "200", "220", "230", "240", "250", "260", "280", "300", "320", "350", 
    "380", "400", "420", "430", "450", "500", "560", "600", "A-CLASS", "B-CLASS", 
    "C-CLASS", "CL-CLASS", "CLA-CLASS", "CLS-CLASS", "E-CLASS", "G-CLASS", "GL-CLASS", 
    "GLA-CLASS", "GLB-CLASS", "GLC-CLASS", "GLE-CLASS", "GLK-CLASS", "GLS-CLASS", 
    "M-CLASS", "ML-CLASS", "R-CLASS", "S-CLASS", "SL-CLASS", "SLK-CLASS", "SLR", 
    "SLS", "SPRINTER"
  ],
  "MINI": [
    "CLUBMAN", "CONVERTIBLE", "COOPER", "COUNTRYMAN", "COUPE", "HARDTOP", "PACEMAN", 
    "ROADSTER"
  ],
  "MITSUBISHI": [
    "3000GT", "DIAMANTE", "ECLIPSE", "ENDEAVOR", "GALANT", "LANCER", "MIRAGE", 
    "MONTERO", "OUTLANDER", "OUTLANDER SPORT", "PAJERO", "RVR"
  ],
  "NISSAN": [
    "200SX", "240SX", "300ZX", "350Z", "370Z", "ALTIMA", "ARMADA", "CUBE", "FRONTIER", 
    "GT-R", "JUKE", "KICKS", "LEAF", "MAXIMA", "MURANO", "NAVARA", "PATHFINDER", 
    "QUEST", "ROGUE", "SENTRA", "TITAN", "VERSA", "XTERRA"
  ],
  "PONTIAC": [
    "AZTEK", "BONNEVILLE", "FIREBIRD", "G3", "G5", "G6", "G8", "GRAND AM", "GRAND PRIX", 
    "GTO", "MONTANA", "SOLSTICE", "SUNBIRD", "SUNFIRE", "TORRENT", "TRANS AM", "VIBE", "WAVE"
  ],
  "PORSCHE": [
    "911", "918", "924", "928", "944", "968", "BOXSTER", "CAYENNE", "CAYMAN", "MACAN", 
    "PANAMERA", "TAYCAN"
  ],
  "RAM": [
    "1500", "2500", "3500", "CARGO VAN", "PROMASTER", "PROMASTER CITY"
  ],
  "SAAB": [
    "9-2X", "9-3", "9-4X", "9-5", "9-7X", "900", "9000"
  ],
  "SATURN": [
    "ASTRA", "AURA", "ION", "L-SERIES", "OUTLOOK", "RELAY", "S-SERIES", "SKY", "VUE"
  ],
  "SUBARU": [
    "ASCENT", "BAJA", "BRZ", "CROSSTREK", "FORESTER", "IMPREZA", "JUSTY", "LEGACY", 
    "OUTBACK", "SVX", "TRIBECA", "WRX", "XV"
  ],
  "SUZUKI": [
    "AERIO", "EQUATOR", "ESTEEM", "FORENZA", "GRAND VITARA", "KIZASHI", "RENO", 
    "RIDGELINE", "SAMURAI", "SIDEKICK", "SWIFT", "SX4", "VERONA", "VITARA", "XL7"
  ],
  "TESLA": [
    "MODEL 3", "MODEL S", "MODEL X", "MODEL Y", "ROADSTER", "CYBERTRUCK"
  ],
  "TOYOTA": [
    "4RUNNER", "86", "AVALON", "AVENSIS", "AYGO", "C-HR", "CAMRY", "CELICA", "COROLLA", 
    "ECHO", "FJ CRUISER", "HIGHLANDER", "LAND CRUISER", "MATRIX", "PRIUS", "RAV4", 
    "SEQUOIA", "SIENNA", "SOLARA", "SUPRA", "TACOMA", "TERCEL", "TUNDRA", "VENZA", "YARIS"
  ],
  "VOLKSWAGEN": [
    "ATLAS", "BEETLE", "CABRIO", "CC", "CORRADO", "EOS", "EUROVAN", "GOLF", "GTI", 
    "JETTA", "PASSAT", "PHAETON", "RABBIT", "ROUTAN", "TIGUAN", "TOUAREG", "TOURAN"
  ],
  "VOLVO": [
    "240", "260", "740", "760", "780", "850", "940", "960", "C30", "C70", "S40", 
    "S60", "S70", "S80", "S90", "V40", "V50", "V60", "V70", "V90", "XC40", "XC60", 
    "XC70", "XC90"
  ]
};

// Common abbreviations and variations
const MAKE_VARIATIONS = {
  "MERC": "MERCEDES-BENZ",
  "MERCEDES": "MERCEDES-BENZ",
  "BENZ": "MERCEDES-BENZ",
  "BMW": "BMW",
  "VW": "VOLKSWAGEN",
  "VOLKSWAGEN": "VOLKSWAGEN",
  "CHEV": "CHEVROLET",
  "CHEVY": "CHEVROLET",
  "FORD": "FORD",
  "HONDA": "HONDA",
  "TOYOTA": "TOYOTA",
  "NISSAN": "NISSAN",
  "HYUNDAI": "HYUNDAI",
  "KIA": "KIA",
  "SUBARU": "SUBARU",
  "MAZDA": "MAZDA",
  "MITSUBISHI": "MITSUBISHI",
  "INFINITI": "INFINITI",
  "LEXUS": "LEXUS",
  "ACURA": "ACURA",
  "AUDI": "AUDI",
  "VOLVO": "VOLVO",
  "SAAB": "SAAB",
  "JEEP": "JEEP",
  "DODGE": "DODGE",
  "CHRYSLER": "CHRYSLER",
  "BUICK": "BUICK",
  "CADILLAC": "CADILLAC",
  "GMC": "GMC",
  "PONTIAC": "PONTIAC",
  "SATURN": "SATURN",
  "LINCOLN": "LINCOLN",
  "MERCURY": "MERCURY",
  "JAGUAR": "JAGUAR",
  "LANDROVER": "LAND ROVER",
  "LAND-ROVER": "LAND ROVER",
  "PORSCHE": "PORSCHE",
  "TESLA": "TESLA",
  "MINI": "MINI",
  "FIAT": "FIAT",
  "ALFA": "ALFA ROMEO",
  "ALFA-ROMEO": "ALFA ROMEO"
};

// Model variations and common abbreviations
const MODEL_VARIATIONS = {
  // BMW
  "3": "3 SERIES",
  "5": "5 SERIES",
  "7": "7 SERIES",
  
  // Mercedes
  "C": "C-CLASS",
  "E": "E-CLASS",
  "S": "S-CLASS",
  "ML": "ML-CLASS",
  "GL": "GL-CLASS",
  
  // Common abbreviations
  "ACCORD": "ACCORD",
  "CIVIC": "CIVIC",
  "CAMRY": "CAMRY",
  "COROLLA": "COROLLA",
  "ALTIMA": "ALTIMA",
  "SENTRA": "SENTRA",
  "ELANTRA": "ELANTRA",
  "SONATA": "SONATA",
  "OPTIMA": "OPTIMA",
  "FORTE": "FORTE",
  "IMPREZA": "IMPREZA",
  "OUTBACK": "OUTBACK",
  "LEGACY": "LEGACY",
  "CX-5": "CX-5",
  "CX-9": "CX-9",
  "RAV4": "RAV4",
  "HIGHLANDER": "HIGHLANDER",
  "CR-V": "CR-V",
  "PILOT": "PILOT",
  "ROGUE": "ROGUE",
  "PATHFINDER": "PATHFINDER",
  "MURANO": "MURANO",
  "TUCSON": "TUCSON",
  "SANTA FE": "SANTA FE",
  "SORENTO": "SORENTO",
  "SPORTAGE": "SPORTAGE",
  "FORESTER": "FORESTER",
  "XV": "XV",
  "CROSSTREK": "CROSSTREK"
};

/**
 * Main function to parse vehicle title into components
 * @param {string} title - The vehicle listing title
 * @returns {object} - Object containing year, make, model, and confidence scores
 */
function parseVehicleTitle(title) {
  if (!title || typeof title !== 'string') {
    return {
      year: "N/A",
      make: "N/A", 
      model: "N/A",
      confidence: {
        year: 0,
        make: 0,
        model: 0,
        overall: 0
      },
      originalTitle: title
    };
  }

  // Clean and normalize the title
  const cleanTitle = title.toUpperCase().trim();
  
  // Initialize result object
  const result = {
    year: "N/A",
    make: "N/A",
    model: "N/A",
    confidence: {
      year: 0,
      make: 0,
      model: 0,
      overall: 0
    },
    originalTitle: title
  };

  console.log("Parsing vehicle title:", title);

  // Step 1: Extract Year (first priority)
  const yearResult = extractYear(cleanTitle);
  result.year = yearResult.year;
  result.confidence.year = yearResult.confidence;

  // Step 2: Extract Make (using the remaining text after year)
  const makeResult = extractMake(cleanTitle, result.year);
  result.make = makeResult.make;
  result.confidence.make = makeResult.confidence;

  // Step 3: Extract Model (using remaining text after year and make)
  const modelResult = extractModel(cleanTitle, result.year, result.make);
  result.model = modelResult.model;
  result.confidence.model = modelResult.confidence;

  // Calculate overall confidence
  result.confidence.overall = Math.round(
    (result.confidence.year + result.confidence.make + result.confidence.model) / 3
  );

  console.log("Parsed result:", result);
  return result;
}

/**
 * Extract year from title
 * @param {string} title - Cleaned title
 * @returns {object} - Year and confidence
 */
function extractYear(title) {
  const yearPattern = /\b(19[8-9]\d|20[0-4]\d)\b/g;
  const matches = title.match(yearPattern);
  
  if (matches && matches.length > 0) {
    // Take the first year found (usually at the beginning)
    const year = matches[0];
    const currentYear = new Date().getFullYear();
    
    // Confidence based on year reasonableness
    let confidence = 100;
    if (parseInt(year) > currentYear + 1) {
      confidence = 50; // Future year, less confident
    } else if (parseInt(year) < 1980) {
      confidence = 70; // Very old car, still possible
    }
    
    return { year, confidence };
  }
  
  return { year: "N/A", confidence: 0 };
}

/**
 * Extract make from title
 * @param {string} title - Cleaned title
 * @param {string} year - Already extracted year
 * @returns {object} - Make and confidence
 */
function extractMake(title, year) {
  // Remove year from title to focus on make/model
  let workingTitle = title;
  if (year !== "N/A") {
    workingTitle = title.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
  }
  
  // Remove common non-vehicle words
  const commonWords = [
    'FOR', 'SALE', 'SOLD', 'REDUCED', 'PRICE', 'OBO', 'FIRM', 'CERTIFIED',
    'ACCIDENT', 'FREE', 'CLEAN', 'TITLE', 'CARFAX', 'AUTOCHECK', 'MINT',
    'CONDITION', 'EXCELLENT', 'GOOD', 'FAIR', 'NEEDS', 'WORK', 'RUNS',
    'DRIVES', 'WELL', 'GREAT', 'AMAZING', 'BEAUTIFUL', 'GORGEOUS', 'STUNNING',
    'RARE', 'CLASSIC', 'VINTAGE', 'COLLECTIBLE', 'ORIGINAL', 'RESTORED',
    'MODIFIED', 'CUSTOM', 'LOWERED', 'LIFTED', 'TURBO', 'SUPERCHARGED',
    'MANUAL', 'AUTOMATIC', 'STICK', 'SHIFT', 'TRANSMISSION', 'AWD', '4WD',
    '2WD', 'FWD', 'RWD', 'LEATHER', 'SUNROOF', 'NAVIGATION', 'GPS', 'BACKUP',
    'CAMERA', 'HEATED', 'SEATS', 'REMOTE', 'START', 'KEYLESS', 'ENTRY'
  ];
  
  commonWords.forEach(word => {
    workingTitle = workingTitle.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  });
  
  // Clean up extra spaces
  workingTitle = workingTitle.replace(/\s+/g, ' ').trim();
  
  // Split into words for analysis
  const words = workingTitle.split(' ').filter(word => word.length > 0);
  
  // Try to find exact make matches first
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Check direct make variations
    if (MAKE_VARIATIONS[word]) {
      return { 
        make: MAKE_VARIATIONS[word], 
        confidence: 95 
      };
    }
    
    // Check direct database matches
    if (VEHICLE_DATABASE[word]) {
      return { 
        make: word, 
        confidence: 100 
      };
    }
    
    // Check multi-word makes (like LAND ROVER, ALFA ROMEO)
    if (i < words.length - 1) {
      const twoWordMake = `${word} ${words[i + 1]}`;
      if (VEHICLE_DATABASE[twoWordMake]) {
        return { 
          make: twoWordMake, 
          confidence: 100 
        };
      }
      
      // Check variations of two-word makes
      if (MAKE_VARIATIONS[twoWordMake]) {
        return { 
          make: MAKE_VARIATIONS[twoWordMake], 
          confidence: 95 
        };
      }
    }
  }
  
  // Try fuzzy matching for common misspellings or partial matches
  for (const word of words) {
    for (const [variation, actualMake] of Object.entries(MAKE_VARIATIONS)) {
      if (word.includes(variation) || variation.includes(word)) {
        if (word.length >= 3) { // Avoid very short matches
          return { 
            make: actualMake, 
            confidence: 80 
          };
        }
      }
    }
  }
  
  // Last resort: check if any word is a substring of a known make
  for (const word of words) {
    if (word.length >= 4) { // Only check words with 4+ characters
      for (const make of Object.keys(VEHICLE_DATABASE)) {
        if (make.includes(word) || word.includes(make.substring(0, Math.min(4, make.length)))) {
          return { 
            make, 
            confidence: 60 
          };
        }
      }
    }
  }
  
  return { make: "N/A", confidence: 0 };
}

/**
 * Extract model from title
 * @param {string} title - Cleaned title
 * @param {string} year - Already extracted year
 * @param {string} make - Already extracted make
 * @returns {object} - Model and confidence
 */
function extractModel(title, year, make) {
  if (make === "N/A") {
    return { model: "N/A", confidence: 0 };
  }
  
  // Remove year and make from title
  let workingTitle = title;
  
  if (year !== "N/A") {
    workingTitle = workingTitle.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
  }
  
  // Remove make (handle multi-word makes)
  const makeWords = make.split(' ');
  makeWords.forEach(makeWord => {
    workingTitle = workingTitle.replace(new RegExp(`\\b${makeWord}\\b`, 'g'), '').trim();
  });
  
  // Remove common descriptive words that aren't part of model names
  const descriptiveWords = [
    'FOR', 'SALE', 'SOLD', 'REDUCED', 'PRICE', 'OBO', 'FIRM', 'CERTIFIED',
    'ACCIDENT', 'FREE', 'CLEAN', 'TITLE', 'CARFAX', 'AUTOCHECK', 'MINT',
    'CONDITION', 'EXCELLENT', 'GOOD', 'FAIR', 'NEEDS', 'WORK', 'RUNS',
    'DRIVES', 'WELL', 'GREAT', 'AMAZING', 'BEAUTIFUL', 'GORGEOUS', 'STUNNING',
    'RARE', 'CLASSIC', 'VINTAGE', 'COLLECTIBLE', 'ORIGINAL', 'RESTORED',
    'MODIFIED', 'CUSTOM', 'LOWERED', 'LIFTED', 'TURBO', 'SUPERCHARGED',
    'MANUAL', 'AUTOMATIC', 'STICK', 'SHIFT', 'TRANSMISSION', 'AWD', '4WD',
    '2WD', 'FWD', 'RWD', 'LEATHER', 'SUNROOF', 'NAVIGATION', 'GPS', 'BACKUP',
    'CAMERA', 'HEATED', 'SEATS', 'REMOTE', 'START', 'KEYLESS', 'ENTRY',
    'KM', 'KMS', 'KILOMETERS', 'MILES', 'MILEAGE', 'LOW', 'HIGH', 'HIGHWAY',
    'CITY', 'DRIVEN', 'ONLY', 'JUST', 'RECENTLY', 'SERVICED', 'MAINTAINED',
    'SAFETIED', 'ETESTED', 'EMISSIONS', 'TESTED', 'PASSED', 'CERTIFIED'
  ];
  
  descriptiveWords.forEach(word => {
    workingTitle = workingTitle.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  });
  
  // Clean up extra spaces and punctuation
  workingTitle = workingTitle.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (!workingTitle) {
    return { model: "N/A", confidence: 0 };
  }
  
  // Get the models for this make
  const makeModels = VEHICLE_DATABASE[make] || [];
  
  // Split remaining text into potential model parts
  const words = workingTitle.split(' ').filter(word => word.length > 0);
  
  // Try to find exact model matches
  for (let i = 0; i < words.length; i++) {
    // Try single word models
    const singleWord = words[i];
    if (makeModels.includes(singleWord)) {
      return { 
        model: singleWord, 
        confidence: 100 
      };
    }
    
    // Try two-word models
    if (i < words.length - 1) {
      const twoWords = `${words[i]} ${words[i + 1]}`;
      if (makeModels.includes(twoWords)) {
        return { 
          model: twoWords, 
          confidence: 100 
        };
      }
    }
    
    // Try three-word models (rare but exist)
    if (i < words.length - 2) {
      const threeWords = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (makeModels.includes(threeWords)) {
        return { 
          model: threeWords, 
          confidence: 100 
        };
      }
    }
  }
  
  // Try model variations
  for (const word of words) {
    if (MODEL_VARIATIONS[word]) {
      const standardModel = MODEL_VARIATIONS[word];
      if (makeModels.includes(standardModel)) {
        return { 
          model: standardModel, 
          confidence: 95 
        };
      }
    }
  }
  
  // Try partial matches for models
  for (const word of words) {
    if (word.length >= 3) {
      for (const model of makeModels) {
        // Check if word is contained in model or vice versa
        if (model.includes(word) || word.includes(model)) {
          return { 
            model, 
            confidence: 80 
          };
        }
        
        // Check if word starts with model name (for variants like "ACCORD EX")
        if (word.startsWith(model) || model.startsWith(word)) {
          return { 
            model, 
            confidence: 85 
          };
        }
      }
    }
  }
  
  // If no specific model found, return the cleaned remaining text as model
  if (workingTitle.length > 0 && workingTitle.length < 50) {
    return { 
      model: workingTitle, 
      confidence: 40 
    };
  }
  
  return { model: "N/A", confidence: 0 };
}

/**
 * Enhanced parsing function that integrates with existing extraction
 * @param {object} existingData - Data already extracted by common.js
 * @returns {object} - Enhanced data with better year, make, model parsing
 */
function enhanceVehicleData(existingData) {
  if (!existingData || !existingData.title) {
    return existingData;
  }
  
  // Parse the title with our enhanced parser
  const parsedVehicle = parseVehicleTitle(existingData.title);
  
  // Use parsed data if confidence is high, otherwise keep existing
  const result = { ...existingData };
  
  if (parsedVehicle.confidence.year > 80) {
    result.year = parsedVehicle.year;
  }
  
  if (parsedVehicle.confidence.make > 70) {
    result.make = parsedVehicle.make;
  }
  
  if (parsedVehicle.confidence.model > 60) {
    result.model = parsedVehicle.model;
  }
  
  // Add confidence scores for debugging
  result.parsingConfidence = parsedVehicle.confidence;
  
  return result;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    parseVehicleTitle,
    enhanceVehicleData,
    VEHICLE_DATABASE,
    MAKE_VARIATIONS,
    MODEL_VARIATIONS
  };
} else {
  // Browser environment
  window.vehicleParser = {
    parseVehicleTitle,
    enhanceVehicleData,
    VEHICLE_DATABASE,
    MAKE_VARIATIONS,
    MODEL_VARIATIONS
  };
}