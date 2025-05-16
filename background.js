// Listen for extension installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Marketplace Vehicle Collector installed');
  
  // Initialize storage
  chrome.storage.local.get('listings', function(data) {
    if (!data.listings) {
      chrome.storage.local.set({listings: []});
    }
  });
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "save_listing") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "captureListing"});
    });
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle screenshot request
  if (request.action === "takeScreenshot") {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      if (chrome.runtime.lastError) {
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        sendResponse({success: true, screenshotUrl: dataUrl});
      }
    });
    return true; // Will respond asynchronously
  }
  
  // Handle Excel download request
  if (request.action === "downloadExcel") {
    generateAndDownloadFiles()
      .then(() => sendResponse({success: true}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true; // Will respond asynchronously
  }
});

// Generate and download Excel file and screenshots
async function generateAndDownloadFiles() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('listings', function(data) {
      const listings = data.listings || [];
      
      if (listings.length === 0) {
        reject(new Error("No listings saved"));
        return;
      }
      
      try {
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        
        // Prepare data for worksheet
        const worksheetData = listings.map((listing, index) => ({
          'Title': listing.title,
          'Price': listing.price,
          'Location': listing.location,
          'Date Posted': listing.date,
          'Vehicle Info': listing.vehicleInfo,
          'Listing URL': listing.listingUrl,
          'Screenshot': `=HYPERLINK("screenshots/${listing.screenshotFilename}", "View Screenshot")`
        }));
        
        // Create worksheet and add to workbook
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicle Listings");
        
        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, {bookType: 'xlsx', type: 'array'});
        
        // Create zip file with Excel and screenshots
        const zip = new JSZip();
        
        // Add Excel to zip
        zip.file("marketplace_listings.xlsx", excelBuffer);
        
        // Create screenshots folder
        const screenshotsFolder = zip.folder("screenshots");
        
        // Add all screenshots to zip
        for (const listing of listings) {
          // Convert data URL to blob
          const imageData = listing.screenshotUrl.split(',')[1];
          screenshotsFolder.file(listing.screenshotFilename, imageData, {base64: true});
        }
        
        // Generate zip file
        zip.generateAsync({type: 'blob'}).then(function(content) {
          // Create URL for download
          const url = URL.createObjectURL(content);
          
          // Download the zip
          chrome.downloads.download({
            url: url,
            filename: "marketplace_vehicle_data.zip",
            saveAs: true
          }, function(downloadId) {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}