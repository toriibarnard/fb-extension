// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "captureScreenshot") {
    // We'll just return success - actual screenshot is taken by the background script
    sendResponse({success: true, screenshot: "pending"});
    return true;
  }
  
  if (request.action === "scrapeData") {
    try {
      const listingData = scrapeListingData();
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
  
  // Extract title
  let title = "";
  const titleElement = document.querySelector('[data-testid="marketplace_pdp_title"]');
  if (titleElement) {
    title = titleElement.textContent.trim();
  }
  
  // Extract price
  let price = "";
  const priceElement = document.querySelector('[data-testid="marketplace_pdp_price"]');
  if (priceElement) {
    price = priceElement.textContent.trim();
  }
  
  // Extract location
  let location = "";
  const locationElement = document.querySelector('[data-testid="marketplace_pdp_location"]');
  if (locationElement) {
    location = locationElement.textContent.trim();
  }
  
  // Extract date posted - this is trickier as Facebook doesn't have a consistent selector
  let datePosted = "";
  const possibleDateElements = document.querySelectorAll('span');
  for (const element of possibleDateElements) {
    const text = element.textContent.trim();
    if (text.includes('Posted') || text.match(/\\d+\\s+(minutes|hours|days|weeks|months)\\s+ago/)) {
      datePosted = text;
      break;
    }
  }
  
  // Extract seller name
  let sellerName = "";
  const sellerElement = document.querySelector('[data-testid="marketplace_pdp_seller_info"] span');
  if (sellerElement) {
    sellerName = sellerElement.textContent.trim();
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