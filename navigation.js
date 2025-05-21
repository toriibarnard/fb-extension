// navigation.js - Simplified version that only handles closing listings

/**
 * Closes the current Facebook Marketplace listing by finding and clicking the X button
 * @returns {boolean} True if the listing was successfully closed, false otherwise
 */
function closeCurrentListing() {
  console.log("Closing current listing");
  
  // Check if we're actually viewing a listing
  if (!isViewingListing()) {
    console.log("Not currently viewing a listing");
    return false;
  }
  
  // Try multiple selectors for the close button in order of likelihood
  const closeButtonSelectors = [
    // Most common close button selector
    'button[aria-label="Close"]',
    
    // Alternative selectors if the first one doesn't exist
    'div[role="dialog"] button:first-child',
    'div[role="dialog"] div[aria-label="Close"]',
    'div[role="dialog"] div[role="button"]',
    'div[aria-label="Dialog content"] button[type="button"]',
    'div[role="presentation"] button[type="button"]'
  ];
  
  // Try each selector until we find a working close button
  for (const selector of closeButtonSelectors) {
    const closeButton = document.querySelector(selector);
    if (closeButton) {
      console.log(`Found close button using selector: ${selector}`);
      closeButton.click();
      return true;
    }
  }
  
  // If we get here, we couldn't find a close button
  console.error("Could not find a close button");
  return false;
}

/**
 * Checks if we're currently viewing a Marketplace listing
 * @returns {boolean} True if viewing a listing, false otherwise
 */
function isViewingListing() {
  // Marketplace listings have /item/ in the URL
  return window.location.href.includes('/item/') || 
         // Also check for dialog presence as a fallback
         document.querySelector('div[role="dialog"]') !== null;
}

// Export functions for use in other scripts
window.fbMarketplaceNavigation = {
  closeCurrentListing,
  isViewingListing
};