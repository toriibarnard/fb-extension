// common.js - Shared functions for both popup and background scripts

// Improved extractListingData function with more robust pattern matching
function extractListingData() {
  console.log("Starting extraction with improved pattern matching");
  
  // Initialize with empty values
  const data = {
    title: "N/A",
    price: "N/A",
    location: "N/A",
    datePosted: "N/A",
    sellerName: "N/A",
    mileage: "N/A",
    url: window.location.href,
    year: "N/A",
    make: "N/A",
    model: "N/A"
  };
  
  // Get all text elements for analysis
  const allTextElements = Array.from(document.querySelectorAll('span, div, h1, h2, h3, p'))
    .filter(el => {
      const text = el.textContent.trim();
      return text && text.length > 0 && text.length < 200;
    })
    .map(el => ({
      element: el,
      text: el.textContent.trim(),
      fontSize: parseInt(window.getComputedStyle(el).fontSize || '0')
    }));
  
  // Log all elements for debugging
  console.log("Found " + allTextElements.length + " text elements");
  
  // FIND TITLE - multiple approaches
  // Approach 1: Find text with year pattern that's near the top
  const yearPattern = /\b(19|20)\d{2}\b/;
  const titleElements = allTextElements.filter(item => 
    yearPattern.test(item.text) && 
    item.text.length > 5 && 
    item.text.length < 100 &&
    !item.text.includes("Listed") &&
    !item.text.includes("Marketplace") &&
    item.fontSize >= 16 // Likely a heading or title
  );
  
  // Store the title element for later contextual searches
  const titleElement = titleElements.length > 0 ? titleElements[0].element : null;
  
  if (titleElements.length > 0) {
    data.title = titleElements[0].text;
    console.log("Found title (with year):", data.title);
    
    // Extract year, make, model if present
    const yearMatch = data.title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      data.year = yearMatch[0];
      
      // Attempt to extract make/model
      const afterYear = data.title.substring(data.title.indexOf(data.year) + 4).trim();
      const parts = afterYear.split(' ');
      if (parts.length > 0) {
        data.make = parts[0];
        if (parts.length > 1) {
          data.model = parts.slice(1).join(' ');
        }
      }
    }
  } else {
    // Approach 2: Larger font size elements near the top
    const sortedByFontSize = [...allTextElements].sort((a, b) => b.fontSize - a.fontSize);
    
    for (const item of sortedByFontSize) {
      if (item.text.length > 5 && 
          item.text.length < 100 && 
          !item.text.includes("Marketplace") &&
          !item.text.includes("Facebook") &&
          !item.text.includes("Listed") &&
          !item.text.includes("Message") &&
          item.fontSize >= 16) {
        
        data.title = item.text;
        console.log("Found title (by font size):", data.title);
        break;
      }
    }
  }
  
  // FIND PRICE - focus on the visible viewport
  // The visible listing will be in the main part of the viewport
  const pricePattern = /^CA\$[\d,]+$/;
  let foundPrice = false;
  
  console.log("Using viewport-based approach for price");
  
  // Get the viewport dimensions
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  // Define the "main content area" where the current listing likely appears
  // Usually in the center portion of the screen, not at the edges
  const mainContentArea = {
    top: viewportHeight * 0.1,     // 10% from top
    bottom: viewportHeight * 0.7,  // 70% from top
    left: viewportWidth * 0.2,     // 20% from left
    right: viewportWidth * 0.8     // 80% from left
  };
  
  console.log("Main content area:", mainContentArea);
  
  // Get all price elements and check their position in the viewport
  const allPriceElements = [];
  document.querySelectorAll('*').forEach(el => {
    const text = el.textContent.trim();
    if (pricePattern.test(text)) {
      const rect = el.getBoundingClientRect();
      // Check if the element is in the main content area
      const inMainContent = (
        rect.top >= mainContentArea.top &&
        rect.bottom <= mainContentArea.bottom &&
        rect.left >= mainContentArea.left &&
        rect.right <= mainContentArea.right
      );
      
      allPriceElements.push({
        element: el,
        text: text,
        rect: rect,
        fontSize: parseInt(window.getComputedStyle(el).fontSize || '0'),
        inMainContent: inMainContent
      });
    }
  });
  
  console.log("Found " + allPriceElements.length + " price elements");
  
  // First priority: Price elements in the main content area with larger font
  const mainContentPrices = allPriceElements
    .filter(item => item.inMainContent)
    .sort((a, b) => b.fontSize - a.fontSize); // Sort by font size
  
  if (mainContentPrices.length > 0) {
    data.price = mainContentPrices[0].text;
    console.log("Found price in main content area:", data.price);
    foundPrice = true;
  }
  
  // Second priority: If we have the title, find prices near the title in the DOM
  if (!foundPrice && titleElement) {
    // Get all ancestors up to 3 levels
    const ancestors = [];
    let current = titleElement.parentElement;
    for (let i = 0; i < 3; i++) {
      if (!current) break;
      ancestors.push(current);
      current = current.parentElement;
    }
    
    // Check if any price elements are descendants of these ancestors
    for (const ancestor of ancestors) {
      if (foundPrice) break;
      
      // For each price element, check if it's a descendant of this ancestor
      for (const priceItem of allPriceElements) {
        let el = priceItem.element;
        while (el) {
          if (el === ancestor) {
            data.price = priceItem.text;
            console.log("Found price in same section as title:", data.price);
            foundPrice = true;
            break;
          }
          el = el.parentElement;
        }
        if (foundPrice) break;
      }
    }
  }
  
  // Third priority: Use the largest, most visible price on screen
  if (!foundPrice) {
    // Calculate visibility score based on size and position
    const scoredPrices = allPriceElements.map(item => {
      // Center of the viewport has higher score
      const centerX = viewportWidth / 2;
      const centerY = viewportHeight / 2;
      const elementCenterX = item.rect.left + (item.rect.width / 2);
      const elementCenterY = item.rect.top + (item.rect.height / 2);
      
      // Distance from center (normalized)
      const distanceFromCenter = Math.sqrt(
        Math.pow(elementCenterX - centerX, 2) + 
        Math.pow(elementCenterY - centerY, 2)
      ) / Math.sqrt(Math.pow(viewportWidth, 2) + Math.pow(viewportHeight, 2));
      
      // Font size score (larger is better)
      const fontSizeScore = item.fontSize / 24; // normalize against typical h1 size
      
      // Combine scores - prioritize visible, large text
      const visibilityScore = fontSizeScore * (1 - distanceFromCenter);
      
      return {
        ...item,
        score: visibilityScore
      };
    }).sort((a, b) => b.score - a.score); // Sort by score
    
    if (scoredPrices.length > 0) {
      data.price = scoredPrices[0].text;
      console.log("Found price with highest visibility score:", data.price);
      foundPrice = true;
    }
  }
  
  // Fallback to any price element if we still haven't found one
  if (!foundPrice && allPriceElements.length > 0) {
    data.price = allPriceElements[0].text;
    console.log("Using fallback price:", data.price);
  }
  
  // TARGETED LOCATION DETECTION - key fix for finding the right location
  // We'll look specifically for location data directly related to the price we found
  
  // Store price element for location reference
  let priceElement = null;
  
  // Find the element containing our identified price
  if (data.price !== "N/A") {
    document.querySelectorAll('*').forEach(el => {
      if (el.textContent.trim() === data.price) {
        priceElement = el;
      }
    });
  }
  
  console.log("Price element found:", priceElement ? "Yes" : "No");
  
  // Location patterns
  const locationPatterns = [
    /^[A-Za-z\s-]+,\s*(NS|NB|PE|NL|ON|QC|MB|SK|AB|BC|YT|NT|NU)$/,  // City, Province with comma
    /^[A-Za-z\s-]+ (NS|NB|PE|NL|ON|QC|MB|SK|AB|BC|YT|NT|NU)$/,      // City Province without comma
    /^\d+\s+(km|miles|minutes|hours)\s+away$/                       // Distance format
  ];
  
  let foundLocation = false;
  
  // STRATEGY 1: Find location element immediately after the price in the DOM
  if (priceElement) {
    console.log("Looking for location after price");
    
    // Get price position
    const priceRect = priceElement.getBoundingClientRect();
    
    // Look for elements below the price in the visual layout
    const elementsBelowPrice = [];
    document.querySelectorAll('span, div, p').forEach(el => {
      // Skip if it's the price element or contains the price text
      if (el === priceElement || el.textContent.trim() === data.price) return;
      
      const text = el.textContent.trim();
      if (!text || text.length > 50) return;
      
      const rect = el.getBoundingClientRect();
      
      // Check if element is reasonably near the price in the layout
      if (rect.top >= priceRect.bottom && 
          rect.top - priceRect.bottom < 150 &&  // Within 150px below
          Math.abs((rect.left + rect.width/2) - (priceRect.left + priceRect.width/2)) < 250) { // Somewhat aligned
        
        elementsBelowPrice.push({
          element: el,
          text: text,
          distance: rect.top - priceRect.bottom // Vertical distance from price
        });
      }
    });
    
    // Sort by vertical distance from price
    elementsBelowPrice.sort((a, b) => a.distance - b.distance);
    
    // Look for location patterns in these elements
    for (const item of elementsBelowPrice) {
      const text = item.text;
      
      // Skip if it contains year pattern (usually part of title)
      if (yearPattern.test(text)) continue;
      
      // Skip if it contains price pattern
      if (pricePattern.test(text)) continue;
      
      // Check against location patterns
      if (locationPatterns.some(pattern => pattern.test(text))) {
        data.location = text;
        console.log("Found location below price matching pattern:", data.location);
        foundLocation = true;
        break;
      }
      
      // Check for simpler pattern of text with comma and province code
      if (text.includes(",") && 
          /(NS|NB|PE|NL|ON|QC|MB|SK|AB|BC|YT|NT|NU)/.test(text) &&
          text.length < 30) {
        data.location = text;
        console.log("Found location below price with province:", data.location);
        foundLocation = true;
        break;
      }
      
      // Check for distance pattern
      if (text.includes("km away") || text.includes("miles away")) {
        data.location = text;
        console.log("Found location with distance:", data.location);
        foundLocation = true;
        break;
      }
    }
  }
  
  // STRATEGY 2: Search for location near price in DOM structure
  if (!foundLocation && priceElement) {
    console.log("Looking for location in DOM structure near price");
    
    // Walk up a few levels from price to find common container
    let searchContainer = priceElement;
    for (let i = 0; i < 3 && !foundLocation; i++) {
      searchContainer = searchContainer.parentElement;
      if (!searchContainer) break;
      
      // Look for location pattern in this container, excluding the price itself
      const locationCandidates = [];
      searchContainer.querySelectorAll('span, div, p').forEach(el => {
        if (el === priceElement || el.contains(priceElement) || priceElement.contains(el)) return;
        
        const text = el.textContent.trim();
        if (!text || text.length > 50) return;
        
        // Skip if it contains year or price
        if (yearPattern.test(text) || pricePattern.test(text)) return;
        
        // Check against location patterns
        let matchesPattern = false;
        for (const pattern of locationPatterns) {
          if (pattern.test(text)) {
            matchesPattern = true;
            break;
          }
        }
        
        // Also check for comma + province or "away" pattern
        const hasProvinceCode = /(NS|NB|PE|NL|ON|QC|MB|SK|AB|BC|YT|NT|NU)/.test(text);
        const isDistanceAway = text.includes("km away") || text.includes("miles away");
        
        if (matchesPattern || (text.includes(",") && hasProvinceCode) || isDistanceAway) {
          locationCandidates.push({
            element: el,
            text: text,
            matchesPattern: matchesPattern
          });
        }
      });
      
      // Prioritize exact pattern matches
      const patternMatches = locationCandidates.filter(item => item.matchesPattern);
      if (patternMatches.length > 0) {
        data.location = patternMatches[0].text;
        console.log("Found location in DOM structure with exact pattern:", data.location);
        foundLocation = true;
      } else if (locationCandidates.length > 0) {
        data.location = locationCandidates[0].text;
        console.log("Found location in DOM structure with approximate pattern:", data.location);
        foundLocation = true;
      }
    }
  }
  
  // STRATEGY 3: Fall back to simple location pattern matching in main content area
  if (!foundLocation) {
    console.log("Falling back to simple location pattern matching");
    
    // Get all elements in the main content area
    const mainContentElements = [];
    document.querySelectorAll('span, div, p').forEach(el => {
      const text = el.textContent.trim();
      if (!text || text.length > 50) return;
      
      // Skip if it contains year or price
      if (yearPattern.test(text) || pricePattern.test(text)) return;
      
      const rect = el.getBoundingClientRect();
      const inMainContent = (
        rect.top >= mainContentArea.top &&
        rect.bottom <= mainContentArea.bottom &&
        rect.left >= mainContentArea.left &&
        rect.right <= mainContentArea.right
      );
      
      if (inMainContent) {
        mainContentElements.push({
          element: el,
          text: text,
          position: rect.top
        });
      }
    });
    
    // Check for location patterns
    for (const item of mainContentElements) {
      const text = item.text;
      
      // Check against location patterns
      let isLocation = false;
      for (const pattern of locationPatterns) {
        if (pattern.test(text)) {
          isLocation = true;
          break;
        }
      }
      
      // Also check for comma + province or "away" pattern
      const hasProvinceCode = /(NS|NB|PE|NL|ON|QC|MB|SK|AB|BC|YT|NT|NU)/.test(text);
      const isDistanceAway = text.includes("km away") || text.includes("miles away");
      
      if (isLocation || (text.includes(",") && hasProvinceCode) || isDistanceAway) {
        data.location = text;
        console.log("Found location in main content area:", data.location);
        foundLocation = true;
        break;
      }
    }
  }
  
  // FIND LISTING DATE - multiple patterns
  // Pattern 1: Text containing "Listed" and possibly "in"
  const dateElements1 = allTextElements.filter(item => 
    item.text.includes("Listed") && 
    item.text.length < 100
  );
  
  // Pattern 2: Text containing time references like "ago"
  const dateElements2 = allTextElements.filter(item => 
    (item.text.includes(" ago") || item.text.includes("Posted")) && 
    item.text.length < 50 &&
    !item.text.includes("Message")
  );
  
  if (dateElements1.length > 0) {
    const fullText = dateElements1[0].text;
    const match = fullText.match(/Listed\s+(.*?)(?:\s+in|$)/i);
    if (match && match[1]) {
      data.datePosted = match[1].trim();
      console.log("Found date (from 'Listed'):", data.datePosted);
    }
  } else if (dateElements2.length > 0) {
    data.datePosted = dateElements2[0].text;
    console.log("Found date (with 'ago'):", data.datePosted);
  }
  
  // FIND MILEAGE - "Driven xxx,xxx km"
  const mileageElements = allTextElements.filter(item => 
    item.text.startsWith("Driven ") && 
    item.text.includes(" km") && 
    item.text.length < 50
  );
  
  if (mileageElements.length > 0) {
    data.mileage = mileageElements[0].text;
    console.log("Found mileage:", data.mileage);
  }
  
  // FIND SELLER NAME - multiple approaches
  // First attempt: Find element after "Seller information" or "Seller details"
  let foundSellerName = false;
  
  // Track if we've seen seller section identifiers
  let sellerInfoIndex = -1;
  let joinedFacebookIndex = -1;
  
  allTextElements.forEach((item, index) => {
    if (item.text === "Seller details" || item.text === "Seller information") {
      sellerInfoIndex = index;
    }
    if (item.text.includes("Joined Facebook")) {
      joinedFacebookIndex = index;
    }
  });
  
  // Look for seller name between "Seller details" and "Joined Facebook"
  if (sellerInfoIndex !== -1 && joinedFacebookIndex !== -1 && joinedFacebookIndex > sellerInfoIndex) {
    for (let i = sellerInfoIndex + 1; i < joinedFacebookIndex; i++) {
      const text = allTextElements[i].text;
      if (text.length > 2 && 
          text.length < 50 && 
          text !== "Seller details" &&
          text !== "Seller information" &&
          !text.includes("Joined") &&
          !text.includes("Message") &&
          !text.includes("available") &&
          /^[A-Za-z\s\.\-']+$/.test(text)) {
        
        data.sellerName = text;
        console.log("Found seller name (between sections):", data.sellerName);
        foundSellerName = true;
        break;
      }
    }
  }
  
  // Second attempt: Look for elements near seller information
  if (!foundSellerName) {
    const sellerSectionElements = document.querySelectorAll('*');
    let inSellerSection = false;
    
    for (const el of sellerSectionElements) {
      const text = el.textContent.trim();
      
      if (!text || text.length > 100) continue;
      
      if (text === "Seller details" || text === "Seller information") {
        inSellerSection = true;
        continue;
      }
      
      if (inSellerSection && 
          text.length > 2 && 
          text.length < 50 && 
          text !== "Seller details" &&
          text !== "Seller information" &&
          !text.includes("Message") &&
          !text.includes("available") &&
          /^[A-Za-z\s\.\-']+$/.test(text)) {
        
        data.sellerName = text;
        console.log("Found seller name (in seller section):", data.sellerName);
        foundSellerName = true;
        break;
      }
      
      // Stop looking if we encounter typical elements after seller section
      if (inSellerSection && 
          (text.includes("Joined Facebook") || text.includes("Description") || text.includes("Details"))) {
        break;
      }
    }
  }
  
  // Final data validation and cleanup
  Object.keys(data).forEach(key => {
    if (data[key] === "N/A" || !data[key]) {
      console.log(`Warning: Could not find ${key}`);
    }
  });
  
  console.log("Final extracted data:", data);
  return data;
}

// Function for database helper functions
// We can add more shared functions here if needed