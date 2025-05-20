// Simplified popup.js
document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const captureBtn = document.getElementById('captureBtn');
  const viewListingsBtn = document.getElementById('viewListingsBtn');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const listingCount = document.getElementById('listingCount');
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const result = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  
  // IndexedDB Database
  let db = null;
  
  // Open the database
  openDatabase();
  updateListingCount();
  
  // Check if we're on a Facebook Marketplace listing
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) return;
    
    const currentTab = tabs[0];
    if (!currentTab.url.includes('facebook.com/marketplace')) {
      captureBtn.disabled = true;
      captureBtn.textContent = 'Not a Marketplace Page';
    }
  });
  
  // Event Listeners
  captureBtn.addEventListener('click', captureMarketplaceListing);
  viewListingsBtn.addEventListener('click', viewAllListings);
  exportBtn.addEventListener('click', exportAllListings);
  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to delete all saved listings?')) {
      clearAllListings();
    }
  });
  
  // Open the IndexedDB database
  function openDatabase() {
    console.log("Opening database...");
    const request = indexedDB.open('FBMarketplaceDB', 1);
    
    request.onerror = function(event) {
      console.error("Database error:", event.target.error);
      showError("Failed to open database. Please check your browser settings.");
    };
    
    request.onupgradeneeded = function(event) {
      console.log("Database upgrade needed");
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('listings')) {
        const listingsStore = db.createObjectStore('listings', { keyPath: 'id' });
        listingsStore.createIndex('dateSaved', 'dateSaved', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('screenshots')) {
        db.createObjectStore('screenshots', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = function(event) {
      db = event.target.result;
      console.log("Database opened successfully");
      updateListingCount();
    };
  }
  
  // Update the listing count display
  function updateListingCount() {
    if (!db) {
      listingCount.textContent = "0";
      return;
    }
    
    try {
      const transaction = db.transaction(['listings'], 'readonly');
      const listingsStore = transaction.objectStore('listings');
      const countRequest = listingsStore.count();
      
      countRequest.onsuccess = function() {
        listingCount.textContent = countRequest.result;
      };
      
      countRequest.onerror = function(event) {
        console.error("Error counting listings:", event.target.error);
        listingCount.textContent = "0";
      };
    } catch (error) {
      console.error("Error in updateListingCount:", error);
      listingCount.textContent = "0";
    }
  }
  
  // Function to capture marketplace listing
  function captureMarketplaceListing() {
    showStatus('Extracting data...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showError("Cannot access current tab.");
        return;
      }
      
      const tabId = tabs[0].id;
      const url = tabs[0].url;
      
      // Extract the data from the page
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: extractListingData
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Script execution error:", chrome.runtime.lastError);
          showError("Error: " + chrome.runtime.lastError.message);
          return;
        }
        
        if (!results || !results[0] || !results[0].result) {
          console.error("No data extracted");
          showError("Could not extract listing data. Please try again.");
          return;
        }
        
        const listingData = results[0].result;
        listingData.url = url;
        listingData.dateSaved = new Date().toISOString();
        listingData.id = 'listing_' + Date.now();
        
        console.log("Data extracted:", listingData);
        showStatus('Taking screenshot...');
        
        // Try to capture screenshot
        try {
          chrome.tabs.captureVisibleTab({format: 'png'}, function(screenshotDataUrl) {
            if (chrome.runtime.lastError || !screenshotDataUrl) {
              console.log("Screenshot error, saving without image");
              saveListing(listingData, null);
              return;
            }
            
            saveListing(listingData, screenshotDataUrl);
          });
        } catch (error) {
          console.error("Exception during screenshot:", error);
          saveListing(listingData, null);
        }
      });
    });
  }
  
  // Save listing to IndexedDB
  function saveListing(listingData, screenshotDataUrl) {
    if (!db) {
      showError("Database not available. Please try again.");
      return;
    }
    
    try {
      const transaction = db.transaction(['listings', 'screenshots'], 'readwrite');
      
      // Save listing data
      const listingsStore = transaction.objectStore('listings');
      listingsStore.put(listingData);
      
      // If we have a screenshot, save it separately
      if (screenshotDataUrl) {
        const screenshotsStore = transaction.objectStore('screenshots');
        screenshotsStore.put({
          id: listingData.id,
          data: screenshotDataUrl
        });
      }
      
      transaction.oncomplete = function() {
        console.log("Listing saved successfully");
        updateListingCount();
        showSuccess("Listing saved successfully!");
      };
      
      transaction.onerror = function(event) {
        console.error("Transaction error:", event.target.error);
        showError("Failed to save listing: " + event.target.error.message);
      };
    } catch (error) {
      console.error("Error in saveListing:", error);
      showError("Error saving listing: " + error.message);
    }
  }
  
  // View all listings
  function viewAllListings() {
    if (!db) {
      showError("Database not available. Please try again.");
      return;
    }
    
    try {
      const transaction = db.transaction(['listings'], 'readonly');
      const listingsStore = transaction.objectStore('listings');
      const getAllRequest = listingsStore.getAll();
      
      getAllRequest.onsuccess = function() {
        const listings = getAllRequest.result;
        if (!listings || listings.length === 0) {
          showError("No listings saved yet.");
          return;
        }
        
        let listingInfo = `Found ${listings.length} saved listings:\n\n`;
        
        listings.forEach((listing, index) => {
          listingInfo += `${index + 1}. ${listing.title || 'Untitled'}\n`;
          listingInfo += `   Price: ${listing.price || 'N/A'}\n`;
          listingInfo += `   Saved: ${new Date(listing.dateSaved).toLocaleString()}\n\n`;
        });
        
        listingInfo += "Use the 'Export All to Excel' button to export all listings.";
        
        alert(listingInfo);
      };
      
      getAllRequest.onerror = function(event) {
        console.error("Error getting listings:", event.target.error);
        showError("Failed to retrieve listings: " + event.target.error.message);
      };
    } catch (error) {
      console.error("Error in viewAllListings:", error);
      showError("Error viewing listings: " + error.message);
    }
  }
  
  // Export all listings
  function exportAllListings() {
    if (!db) {
      showError("Database not available. Please try again.");
      return;
    }
    
    showStatus("Exporting listings...");
    
    try {
      const transaction = db.transaction(['listings', 'screenshots'], 'readonly');
      const listingsStore = transaction.objectStore('listings');
      const screenshotsStore = transaction.objectStore('screenshots');
      const getAllRequest = listingsStore.getAll();
      
      getAllRequest.onsuccess = function() {
        const listings = getAllRequest.result;
        
        if (!listings || listings.length === 0) {
          showError("No listings to export.");
          return;
        }
        
        // Use SheetJS library if available, otherwise fallback to CSV
        if (typeof XLSX !== 'undefined') {
          exportToExcel(listings);
        } else {
          exportToCsv(listings);
        }
      };
      
      getAllRequest.onerror = function(event) {
        console.error("Error getting listings:", event.target.error);
        showError("Failed to retrieve listings: " + event.target.error.message);
      };
    } catch (error) {
      console.error("Error in exportAllListings:", error);
      showError("Error exporting listings: " + error.message);
    }
  }
  
  // Export to Excel using SheetJS
  function exportToExcel(listings) {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Format data for worksheet - use EXACT same columns as Python scraper
      const wsData = [
        ["Title", "Price", "Location", "Mileage", 
         "Seller Name", "Listing Date", "Listing URL", "Scraped Date"]
      ];
      
      // Add each listing as a row - NOT splitting title into year/make/model
      listings.forEach(listing => {
        const row = [
          listing.title || "",     // Keep the full title
          listing.price || "",     
          listing.location || "",  
          listing.mileage || "",   
          listing.sellerName || "", 
          listing.datePosted || "", 
          listing.url || "",       
          new Date().toLocaleString() 
        ];
        
        wsData.push(row);
      });
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Vehicle Listings");
      
      // Generate Excel file
      const excelData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      // Save file with timestamp in name
      const blob = new Blob([excelData], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url = URL.createObjectURL(blob);
      
      const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `nova_scotia_vehicles_${date}.xlsx`;
      
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          console.error("Excel download error:", chrome.runtime.lastError);
          showError("Failed to export: " + chrome.runtime.lastError.message);
          return;
        }
        
        exportScreenshots(listings);
        showSuccess(`Exported ${listings.length} listings to ${filename}`);
      });
    } catch (error) {
      console.error("Error creating Excel file:", error);
      // Fallback to CSV if Excel fails
      exportToCsv(listings);
    }
  }
  
  // Export to CSV (fallback if SheetJS not available)
  function exportToCsv(listings) {
    // CSV headers
    const headers = [
      "Title", "Year", "Make", "Model", "Price", "Location", "Mileage", 
      "Seller Name", "Listing Date", "Listing URL", "Scraped Date"
    ];
    
    const rows = [headers.join(',')];
    
    // Add each listing as a CSV row
    listings.forEach(listing => {
      const row = [
        escapeCsvValue(listing.title || ""),
        escapeCsvValue(listing.year || ""),
        escapeCsvValue(listing.make || ""),
        escapeCsvValue(listing.model || ""),
        escapeCsvValue(listing.price || ""),
        escapeCsvValue(listing.location || ""),
        escapeCsvValue(listing.mileage || ""),
        escapeCsvValue(listing.sellerName || ""),
        escapeCsvValue(listing.datePosted || ""),
        escapeCsvValue(listing.url || ""),
        escapeCsvValue(new Date().toLocaleString())
      ];
      
      rows.push(row.join(','));
    });
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    
    const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `vehicle_listings_${date}.csv`;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        console.error("CSV download error:", chrome.runtime.lastError);
        showError("Failed to export: " + chrome.runtime.lastError.message);
        return;
      }
      
      exportScreenshots(listings);
      showSuccess(`Exported ${listings.length} listings to ${filename}`);
    });
  }
  
  // Export screenshots
  function exportScreenshots(listings) {
    const screenshotDir = 'fb-marketplace-screenshots';
    let exported = 0;
    let toExport = 0;
    
    listings.forEach(listing => {
      const transaction = db.transaction(['screenshots'], 'readonly');
      const screenshotsStore = transaction.objectStore('screenshots');
      const getRequest = screenshotsStore.get(listing.id);
      
      getRequest.onsuccess = function() {
        const screenshot = getRequest.result;
        
        if (screenshot && screenshot.data) {
          toExport++;
          
          const baseFilename = sanitizeFilename(listing.title || listing.id);
          const screenshotFilename = `${screenshotDir}/${baseFilename}.png`;
          
          // Convert data URL to blob and download
          fetch(screenshot.data)
            .then(res => res.blob())
            .then(blob => {
              const url = URL.createObjectURL(blob);
              chrome.downloads.download({
                url: url,
                filename: screenshotFilename,
                saveAs: false,
                conflictAction: 'overwrite'
              }, function() {
                exported++;
                checkIfDone();
              });
            })
            .catch(err => {
              console.error("Error exporting screenshot:", err);
              exported++;
              checkIfDone();
            });
        }
      };
    });
    
    // If no screenshots to export, show success now
    setTimeout(function() {
      if (toExport === 0) {
        showSuccess("Export complete! CSV file saved (no screenshots).");
      }
    }, 500);
    
    function checkIfDone() {
      if (exported === toExport) {
        showSuccess(`Export complete! Saved ${listings.length} listings and ${exported} screenshots.`);
      }
    }
  }
  
  // Clear all listings
  function clearAllListings() {
    if (!db) {
      showError("Database not available. Please try again.");
      return;
    }
    
    try {
      const transaction = db.transaction(['listings', 'screenshots'], 'readwrite');
      
      // Clear listings store
      transaction.objectStore('listings').clear();
      
      // Clear screenshots store
      transaction.objectStore('screenshots').clear();
      
      transaction.oncomplete = function() {
        console.log("All listings cleared");
        updateListingCount();
        showSuccess("All listings have been deleted.");
      };
      
      transaction.onerror = function(event) {
        console.error("Error clearing listings:", event.target.error);
        showError("Failed to clear listings: " + event.target.error.message);
      };
    } catch (error) {
      console.error("Error in clearAllListings:", error);
      showError("Error clearing listings: " + error.message);
    }
  }
  
  // Helper function to sanitize filenames
  function sanitizeFilename(filename) {
    return String(filename)
      .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid filename characters
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .substring(0, 50);              // Limit length
  }
  
  // Escape CSV values to handle commas and quotes
  function escapeCsvValue(value) {
    if (!value) return '';
    value = String(value);
    // If value contains comma, newline, or quote, wrap in quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      // Double up any quotes
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }
  
  // Show status message
  function showStatus(message) {
    result.classList.add('hidden');
    status.classList.remove('hidden');
    statusText.textContent = message;
  }
  
  // Show success message
  function showSuccess(message) {
    status.classList.add('hidden');
    result.classList.remove('hidden');
    resultText.textContent = message;
  }
  
  // Show error message
  function showError(message) {
    console.error(message);
    status.classList.add('hidden');
    result.classList.remove('hidden');
    resultText.textContent = message;
  }
});

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