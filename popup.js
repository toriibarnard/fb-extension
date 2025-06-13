// popup.js - Handles popup UI and interactions
// File location: fb-extension/popup.js

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
      
      // Generate a listing ID that will be used for both database and screenshot filename
      const listingId = generateListingId(url);
      
      // First inject vehicle parser
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['vehicle-parser.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to inject vehicle-parser.js:", chrome.runtime.lastError);
          // Continue even if vehicle parser fails, we can still capture basic data
        }
        
        // Then inject common.js which has our shared functions
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          files: ['common.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to inject common.js:", chrome.runtime.lastError);
            showError("Failed to inject extraction script.");
            return;
          }
          
          // Now execute the extraction function from common.js
          chrome.scripting.executeScript({
            target: {tabId: tabId},
            function: () => extractListingData() // This uses the injected function
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
            listingData.id = listingId;  // Use our generated ID
            
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
          listingInfo += `   Year: ${listing.year || 'N/A'} Make: ${listing.make || 'N/A'} Model: ${listing.model || 'N/A'}\n`;
          listingInfo += `   Listing ID: ${listing.id}\n`;
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
      
      // Format data for worksheet - include Listing ID column
      const wsData = [
        ["Listing ID", "Title", "Year", "Make", "Model", "Price", "Location", "Mileage", 
        "Seller Name", "Listing Date", "Listing URL", "Scraped Date"]
      ];
      
      // Add each listing as a row - including the Listing ID
      listings.forEach(listing => {
        const row = [
          listing.id || "",        // Listing ID - this matches the screenshot filename
          listing.title || "",     
          listing.year || "",      // Enhanced year from vehicle parser
          listing.make || "",      // Enhanced make from vehicle parser
          listing.model || "",     // Enhanced model from vehicle parser
          listing.price || "",     
          listing.location || "",  
          listing.mileage || "",   
          listing.sellerName || "", 
          listing.datePosted || "", 
          listing.url || "",       
          new Date(listing.dateSaved).toLocaleString() 
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
      
      // Create a parent folder for all vehicle listings, then subfolder for Facebook Marketplace data
      const parentFolder = 'Vehicle Listings';
      const mainFolder = `${parentFolder}/Facebook Marketplace`;
      // Create a subfolder for data exports with today's date
      const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const dataDir = `${mainFolder}/data/${today}`;
      
      const filename = `${dataDir}/nova_scotia_vehicles_${date}.xlsx`;
      
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
    // CSV headers - include Listing ID
    const headers = [
      "Listing ID", "Title", "Year", "Make", "Model", "Price", "Location", "Mileage", 
      "Seller Name", "Listing Date", "Listing URL", "Scraped Date"
    ];
    
    const rows = [headers.join(',')];
    
    // Add each listing as a CSV row
    listings.forEach(listing => {
      const row = [
        escapeCsvValue(listing.id || ""),
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
        escapeCsvValue(new Date(listing.dateSaved).toLocaleString())
      ];
      
      rows.push(row.join(','));
    });
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    
    const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // Create a parent folder for all vehicle listings, then subfolder for Facebook Marketplace data
    const parentFolder = 'Vehicle Listings';
    const mainFolder = `${parentFolder}/Facebook Marketplace`;
    // Create a subfolder for data exports with today's date
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const dataDir = `${mainFolder}/data/${today}`;
    
    const filename = `${dataDir}/vehicle_listings_${date}.csv`;
    
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
    // Create a parent folder for all vehicle listings, then subfolder for Facebook Marketplace data
    const parentFolder = 'Vehicle Listings';
    const mainFolder = `${parentFolder}/Facebook Marketplace`;
    // Create a subfolder for screenshots with today's date
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const screenshotDir = `${mainFolder}/screenshots/${today}`;
    
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
          
          // Use the Listing ID as the filename for easy matching with Excel data
          const screenshotFilename = `${screenshotDir}/${listing.id}.png`;
          
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
        showSuccess(`Export complete! Saved ${listings.length} listings and ${exported} screenshots to ${screenshotDir} folder.`);
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
  
  // Helper function to sanitize filenames - not needed for listing IDs
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