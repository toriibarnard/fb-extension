// background.js - Listens for keyboard shortcuts and handles background tasks

// Listen for the keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-listing") {
    console.log("Keyboard shortcut captured: Ctrl+Shift+S / Cmd+Shift+S");
    captureCurrentListing();
  }
});

// Capture the current listing when triggered by keyboard shortcut
function captureCurrentListing() {
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
    
    // Show notification that we're starting to extract data
    showNotification("Facebook Marketplace Scraper", "Extracting listing data...");
    
    // Extract the data from the page - using common.js's extractListingData function
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['common.js']  // First, inject the common.js file
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
        listingData.id = 'listing_' + Date.now();
        
        console.log("Data extracted:", listingData);
        
        // Take screenshot
        chrome.tabs.captureVisibleTab({format: 'png'}, function(screenshotDataUrl) {
          if (chrome.runtime.lastError || !screenshotDataUrl) {
            console.log("Screenshot error, saving without image");
            saveListing(listingData, null);
            return;
          }
          
          saveListing(listingData, screenshotDataUrl);
        });
      });
    });
  });
}

// Save listing to IndexedDB
function saveListing(listingData, screenshotDataUrl) {
  console.log("Saving listing to database");
  
  // Open the database
  const request = indexedDB.open('FBMarketplaceDB', 1);
  
  request.onerror = function(event) {
    console.error("Database error:", event.target.error);
    showNotification("Error", "Failed to open database. Please check your browser settings.");
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
        showNotification("Success", "Listing saved successfully!");
      };
      
      transaction.onerror = function(event) {
        console.error("Transaction error:", event.target.error);
        showNotification("Error", "Failed to save listing: " + event.target.error.message);
      };
    } catch (error) {
      console.error("Error in saveListing:", error);
      showNotification("Error", "Error saving listing: " + error.message);
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