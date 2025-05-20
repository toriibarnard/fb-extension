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
        
        // Create CSV data
        const headers = [
          "Title", "Price", "Location", "Date Posted", "Seller Name", 
          "Listing URL", "Date Saved", "Year", "Make", "Model"
        ];
        
        const rows = [headers.join(',')];
        
        listings.forEach(listing => {
          const row = [
            escapeCsvValue(listing.title || ""),
            escapeCsvValue(listing.price || ""),
            escapeCsvValue(listing.location || ""),
            escapeCsvValue(listing.datePosted || ""),
            escapeCsvValue(listing.sellerName || ""),
            escapeCsvValue(listing.url || ""),
            escapeCsvValue(new Date(listing.dateSaved).toLocaleString() || ""),
            escapeCsvValue(listing.vehicleDetails?.year || ""),
            escapeCsvValue(listing.vehicleDetails?.make || ""),
            escapeCsvValue(listing.vehicleDetails?.model || "")
          ];
          
          rows.push(row.join(','));
        });
        
        const csvContent = rows.join('\n');
        
        // Save CSV file
        const blob = new Blob([csvContent], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
          url: url,
          filename: 'fb-marketplace-listings.csv',
          saveAs: false,
          conflictAction: 'overwrite'
        }, function(downloadId) {
          if (chrome.runtime.lastError) {
            console.error("Download error:", chrome.runtime.lastError);
            showError("Failed to export: " + chrome.runtime.lastError.message);
            return;
          }
          
          // Export screenshots as well
          exportScreenshots(listings);
        });
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

// This function runs directly in the page context
function extractListingData() {
  console.log("Starting data extraction");
  
  let title = "";
  let price = "";
  let location = "";
  let datePosted = "";
  let sellerName = "";
  
  // Try multiple approaches to extract data
  
  // 1. Extract title - try multiple selectors
  const titleSelectors = [
    '[data-testid="marketplace_pdp_title"]',
    'h1',
    'span.x1lliihq',
    '.xzsf02u'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      title = element.textContent.trim();
      break;
    }
  }
  
  // 2. Extract price - try multiple selectors
  const priceSelectors = [
    '[data-testid="marketplace_pdp_price"]',
    'span.x193iq5w',
    '.x1s688f'
  ];
  
  for (const selector of priceSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      price = element.textContent.trim();
      break;
    }
  }
  
  // 3. Extract location from page text
  const allText = document.body.innerText;
  const locationPattern = /in ([A-Za-z\s]+(?:, [A-Za-z\s]+)?)/;
  const locationMatch = allText.match(locationPattern);
  if (locationMatch && locationMatch[1]) {
    location = locationMatch[1].trim();
  }
  
  // 4. Look for date posted and seller name
  const spans = document.querySelectorAll('span');
  for (const span of spans) {
    const text = span.textContent.trim();
    
    if (!datePosted && 
        (text.includes('Posted') || text.includes('ago'))) {
      datePosted = text;
    }
    
    if (!sellerName && span.nextElementSibling) {
      const nextText = span.nextElementSibling.textContent.trim();
      if (text.includes('seller') || text.includes('Seller')) {
        sellerName = nextText;
      }
    }
  }
  
  // 5. Extract vehicle details from title
  let vehicleDetails = {};
  if (title) {
    // Look for year (19xx or 20xx)
    const yearPattern = /\b(19|20)\d{2}\b/;
    const yearMatch = title.match(yearPattern);
    if (yearMatch) {
      vehicleDetails.year = yearMatch[0];
      
      // Common car makes
      const makes = ["Toyota", "Honda", "Ford", "Chevrolet", "Chevy", "BMW", 
                     "Mercedes", "Audi", "Nissan", "Hyundai", "Kia", "Mazda", 
                     "Subaru", "Volkswagen", "VW", "Lexus", "Acura"];
      
      for (const make of makes) {
        if (title.includes(make)) {
          vehicleDetails.make = make;
          
          // Simple model extraction (everything after make until next space)
          const makeIndex = title.indexOf(make) + make.length;
          const afterMake = title.substring(makeIndex).trim();
          const modelMatch = afterMake.match(/^([a-zA-Z0-9]+)/);
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
    vehicleDetails
  };
}