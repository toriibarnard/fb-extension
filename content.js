// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Content script received message:", request);
  
  if (request.action === "captureScreenshot") {
    // We'll just return success - actual screenshot is taken by the background script
    console.log("Screenshot request received in content script");
    sendResponse({success: true, screenshot: "pending"});
    return true;
  }
  
  if (request.action === "scrapeData") {
    try {
      console.log("Scraping data...");
      const listingData = scrapeListingData();
      console.log("Scraped data:", listingData);
      sendResponse(listingData);
    } catch (error) {
      console.error("Error scraping data:", error);
      sendResponse(null);
    }
    return true;
  }
});

// Also listen for keyboard shortcut
document.addEventListener('keydown', function(event) {
  // Check if Ctrl+Shift+S was pressed (same as in manifest.json)
  if (event.ctrlKey && event.shiftKey && event.key === 'S') {
    chrome.runtime.sendMessage({action: "keyboardShortcut"});
  }
});

// Function to scrape listing data
function scrapeListingData() {
  const url = window.location.href;
  let title = "";
  let price = "";
  let location = "";
  let datePosted = "";
  let sellerName = "";
  
  console.log("Starting to scrape data from page");
  
  // Try multiple selectors for different Facebook layouts
  
  // Extract title - try multiple possible selectors
  const titleSelectors = [
    '[data-testid="marketplace_pdp_title"]',
    'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6',
    'h1',
    '.xzsf02u' // Another common title class
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      title = element.textContent.trim();
      console.log("Found title:", title);
      break;
    }
  }
  
  // Extract price - try multiple possible selectors
  const priceSelectors = [
    '[data-testid="marketplace_pdp_price"]',
    'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x676frb.x1lkfr7t.x1lbecb7.x1s688f.xzsf02u',
    'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6:not([data-testid="marketplace_pdp_title"])'
  ];
  
  for (const selector of priceSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      price = element.textContent.trim();
      console.log("Found price:", price);
      break;
    }
  }
  
  // Extract location - try multiple possible selectors
  const locationSelectors = [
    '[data-testid="marketplace_pdp_location"]',
    'span:contains("in")',
    'a[href*="marketplace/item"]'
  ];
  
  for (const selector of locationSelectors) {
    let elements;
    if (selector.includes(':contains')) {
      // Custom contains selector
      elements = Array.from(document.querySelectorAll('span')).filter(el => 
        el.textContent.includes(' in ') && !el.textContent.includes('Posted in')
      );
    } else {
      elements = document.querySelectorAll(selector);
    }
    
    for (const element of elements) {
      const text = element.textContent.trim();
      if (text && text.includes(' in ')) {
        location = text.split(' in ')[1].trim();
        console.log("Found location:", location);
        break;
      }
    }
    
    if (location) break;
  }
  
  // Extract date posted - try multiple possible selectors
  const dateSelectors = [
    'span:contains("Posted")',
    'span:contains("ago")'
  ];
  
  for (const selector of dateSelectors) {
    if (selector.includes(':contains')) {
      // Custom contains selector
      const elements = Array.from(document.querySelectorAll('span')).filter(el => 
        el.textContent.includes('Posted') || 
        el.textContent.includes('ago') ||
        el.textContent.match(/\\d+\\s+(minutes|hours|days|weeks|months)\\s+ago/)
      );
      
      for (const element of elements) {
        const text = element.textContent.trim();
        if (text) {
          datePosted = text;
          console.log("Found date:", datePosted);
          break;
        }
      }
    }
    
    if (datePosted) break;
  }
  
  // Extract seller name - try multiple possible selectors
  const sellerSelectors = [
    '[data-testid="marketplace_pdp_seller_info"] span',
    'a[href*="/user/"]',
    'a[href*="/profile.php"]'
  ];
  
  for (const selector of sellerSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      sellerName = element.textContent.trim();
      console.log("Found seller:", sellerName);
      break;
    }
  }
  
  // Try a fallback method for getting basic page info if selectors failed
  if (!title) {
    const h1 = document.querySelector('h1');
    if (h1) title = h1.textContent.trim();
  }
  
  if (!price) {
    // Look for currency symbols
    const currencyElements = Array.from(document.querySelectorAll('span')).filter(
      el => /[$€£¥]/.test(el.textContent)
    );
    if (currencyElements.length > 0) {
      price = currencyElements[0].textContent.trim();
    }
  }
  
  // Extract vehicle details if present
  let vehicleDetails = {};
  // Look for year/make/model in the title or description
  if (title) {
    // Common patterns: "2015 Toyota Camry" or "Toyota Camry 2015"
    const yearPattern = /\\b(19|20)\\d{2}\\b/;
    const yearMatch = title.match(yearPattern);
    if (yearMatch) {
      vehicleDetails.year = yearMatch[0];
      
      // Try to identify make and model
      // This is simplified - a real implementation would need a database of make/models
      const commonMakes = ["Toyota", "Honda", "Ford", "Chevrolet", "Chevy", "BMW", "Mercedes", "Audi", "Nissan", "Hyundai", "Kia", "Mazda", "Subaru", "Volkswagen", "VW", "Lexus", "Acura"];
      
      for (const make of commonMakes) {
        if (title.includes(make)) {
          vehicleDetails.make = make;
          // Attempt to get model - everything after make until end or year
          const makeIndex = title.indexOf(make) + make.length;
          let modelText = title.substring(makeIndex).trim();
          // Remove year if present in model text
          modelText = modelText.replace(yearPattern, "").trim();
          // Take first word as model (simplified approach)
          const modelMatch = modelText.match(/^\\s*([\\w-]+)/);
          if (modelMatch) {
            vehicleDetails.model = modelMatch[1];
          }
          break;
        }
      }
    }
  }
  
  console.log("Final scraped data:", {
    title,
    price,
    location,
    datePosted,
    sellerName,
    url,
    vehicleDetails
  });
  
  return {
    title,
    price,
    location,
    datePosted,
    sellerName,
    url,
    vehicleDetails
  };
}