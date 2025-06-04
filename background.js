// background.js - Listens for keyboard shortcuts and handles background tasks

// Listen for the keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-listing") {
    console.log("Keyboard shortcut captured: Ctrl+Shift+S / Cmd+Shift+S");
    captureAndClose();
  }
});

// Capture the current listing and then close it
function captureAndClose() {
  // Check if we're on a Facebook Marketplace page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showNotification("Error", "Cannot access current tab.");
      return;
    }
    
    const currentTab = tabs[0];
    const tabId = currentTab.id;
    const url = currentTab.url;
    
    // Only proceed if we're on Facebook Marketplace
    if (!url.includes('facebook.com/marketplace')) {
      showNotification("Not Supported", "This is not a Facebook Marketplace page.");
      return;
    }
    
    // Generate a listing ID that will be used for both database and screenshot filename
    const listingId = generateListingId(url);
    
    // Show notification that we're starting to extract data
    showNotification("Facebook Marketplace Scraper", "Extracting listing data...");
    
    // First, inject our navigation script
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['navigation.js']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to inject navigation.js:", chrome.runtime.lastError);
        // Continue even if navigation fails, we can still capture the listing
      }
      
      // Next, inject the common.js file
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['common.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to inject common.js:", chrome.runtime.lastError);
          showNotification("Error", "Failed to inject extraction script.");
          return;
        }
        
        // Now execute the extraction function
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          function: () => extractListingData() // This will use the injected function
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error("Script execution error:", chrome.runtime.lastError);
            showNotification("Error", "Failed to extract data: " + chrome.runtime.lastError.message);
            return;
          }
          
          if (!results || !results[0] || !results[0].result) {
            console.error("No data extracted");
            showNotification("Error", "Could not extract listing data. Please try again.");
            return;
          }
          
          const listingData = results[0].result;
          listingData.url = url;
          listingData.dateSaved = new Date().toISOString();
          listingData.id = listingId;  // Use our generated ID
          
          console.log("Data extracted:", listingData);
          
          // Take screenshot
          chrome.tabs.captureVisibleTab({format: 'png'}, function(screenshotDataUrl) {
            if (chrome.runtime.lastError || !screenshotDataUrl) {
              console.log("Screenshot error, saving without image");
              saveListing(listingData, null, () => closeCurrentListing(tabId));
              return;
            }
            
            // Save the listing data, then close the listing when done
            saveListing(listingData, screenshotDataUrl, () => closeCurrentListing(tabId));
          });
        });
      });
    });
  });
}

// Generate a consistent listing ID that can be used to match Excel entries with screenshots
function generateListingId(url) {
  // Try to extract the Facebook item ID from the URL if possible
  const fbItemMatch = url.match(/\/item\/(\d+)/);
  const fbItemId = fbItemMatch ? fbItemMatch[1] : '';
  
  // Use the current timestamp for uniqueness
  const timestamp = Date.now();
  
  // Create an ID format that's both unique and meaningful
  // Format: FB-{last 6 digits of FB item ID if available}-{timestamp}
  const shortFbId = fbItemId.length > 6 ? fbItemId.slice(-6) : fbItemId;
  const listingId = `FB-${shortFbId}-${timestamp}`;
  
  return listingId;
}

// Function to close the current listing
function closeCurrentListing(tabId) {
  // Execute the close function from our injected script
  chrome.scripting.executeScript({
    target: {tabId: tabId},
    function: () => {
      // This calls the function we defined in navigation.js
      if (window.fbMarketplaceNavigation) {
        return window.fbMarketplaceNavigation.closeCurrentListing();
      }
      return false;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.error("Close operation error:", chrome.runtime.lastError);
      return;
    }
    
    // We don't need to show a notification for close failure
    // as the user can still close manually if needed
    console.log("Close operation result:", results && results[0] ? results[0].result : false);
  });
}

// Function to save a screenshot directly to the organized folder
function saveScreenshotToFolder(screenshotDataUrl, listingId) {
  // Create a parent folder for all vehicle listings, then subfolder for Facebook Marketplace data
  const parentFolder = 'Vehicle Listings';
  const mainFolder = `${parentFolder}/Facebook Marketplace`;
  // Create a subfolder for screenshots with today's date
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const screenshotDir = `${mainFolder}/screenshots/${today}`;
  
  // Use the Listing ID as the filename for easy matching with Excel data
  const screenshotFilename = `${screenshotDir}/${listingId}.png`;
  
  // Convert data URL to blob and download
  fetch(screenshotDataUrl)
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: screenshotFilename,
        saveAs: false,
        conflictAction: 'overwrite'
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          console.error("Screenshot download error:", chrome.runtime.lastError);
          return;
        }
        console.log(`Screenshot saved to ${screenshotFilename}`);
      });
    })
    .catch(err => {
      console.error("Error saving screenshot:", err);
    });
}


// Save listing to IndexedDB
function saveListing(listingData, screenshotDataUrl, callback) {
  console.log("Saving listing to database");
  
  // Open the database
  const request = indexedDB.open('FBMarketplaceDB', 1);
  
  request.onerror = function(event) {
    console.error("Database error:", event.target.error);
    showNotification("Error", "Failed to open database. Please check your browser settings.");
    if (callback) callback();
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
    const db = event.target.result;
    
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
        updateBadge();
        showNotification("Success", `Listing saved successfully! ID: ${listingData.id}`);
        
        // Call the callback function if provided (to close the listing)
        if (callback) callback();
      };
      
      transaction.onerror = function(event) {
        console.error("Transaction error:", event.target.error);
        showNotification("Error", "Failed to save listing: " + event.target.error.message);
        if (callback) callback();
      };
    } catch (error) {
      console.error("Error in saveListing:", error);
      showNotification("Error", "Error saving listing: " + error.message);
      if (callback) callback();
    }
  };
}

// Show notification to user
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

// Update the badge to show the number of saved listings
function updateBadge() {
  const request = indexedDB.open('FBMarketplaceDB', 1);
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    
    try {
      const transaction = db.transaction(['listings'], 'readonly');
      const listingsStore = transaction.objectStore('listings');
      const countRequest = listingsStore.count();
      
      countRequest.onsuccess = function() {
        const count = countRequest.result;
        chrome.action.setBadgeText({text: count.toString()});
        chrome.action.setBadgeBackgroundColor({color: '#4CAF50'});
      };
    } catch (error) {
      console.error("Error updating badge:", error);
    }
  };
}

