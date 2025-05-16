// Load the SheetJS library
importScripts('xlsx.full.min.js');

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "keyboardShortcut") {
    // User pressed the keyboard shortcut, notify the active tab
    captureCurrentTab();
    return true;
  }
  
  if (request.action === "processListing") {
    processListingData(request.data, sendResponse);
    return true; // Keep the message channel open for the async response
  }
});

// Listen for the command from keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-listing") {
    captureCurrentTab();
  }
});

// Capture the current tab
function captureCurrentTab() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    
    // Check if this is a marketplace page
    if (!currentTab.url.includes('facebook.com/marketplace')) {
      return;
    }
    
    // Send message to the content script
    chrome.tabs.sendMessage(currentTab.id, {action: "captureScreenshot"}, function(response) {
      if (chrome.runtime.lastError || !response) {
        console.error("Error capturing screenshot:", chrome.runtime.lastError);
        return;
      }
      
      // Now get the listing data
      chrome.tabs.sendMessage(currentTab.id, {action: "scrapeData"}, function(listingData) {
        if (chrome.runtime.lastError || !listingData) {
          console.error("Error scraping data:", chrome.runtime.lastError);
          return;
        }
        
        // Now take the actual screenshot
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(screenshotDataUrl) {
          if (chrome.runtime.lastError) {
            console.error("Error taking screenshot:", chrome.runtime.lastError);
            return;
          }
          
          // Process the listing with screenshot and data
          processListingData({
            screenshot: screenshotDataUrl,
            listingData: listingData
          });
        });
      });
    });
  });
}

// Process and save the listing data
function processListingData(data, sendResponse) {
  const { screenshot, listingData } = data;
  
  // Generate filename based on listing title
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = sanitizeFilename(listingData.title || 'fb-marketplace-listing');
  const screenshotFilename = `${baseFilename}-${dateStr}.png`;
  const excelFilename = `${baseFilename}-${dateStr}.xlsx`;
  
  // Save screenshot
  saveScreenshot(screenshot, screenshotFilename, function(screenshotDownloadId) {
    if (!screenshotDownloadId) {
      if (sendResponse) sendResponse({success: false, error: "Failed to save screenshot"});
      return;
    }
    
    // Create Excel file
    createExcelFile(listingData, screenshotFilename, excelFilename, function(excelDownloadId) {
      if (!excelDownloadId) {
        if (sendResponse) sendResponse({success: false, error: "Failed to create Excel file"});
        return;
      }
      
      if (sendResponse) {
        sendResponse({
          success: true,
          screenshotDownloadId: screenshotDownloadId,
          excelDownloadId: excelDownloadId,
          downloadId: excelDownloadId
        });
      }
    });
  });
}

// Save screenshot to a file
function saveScreenshot(dataUrl, filename, callback) {
  // Convert data URL to blob
  const byteString = atob(dataUrl.split(',')[1]);
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], {type: mimeString});
  
  // Save blob to file
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: filename,
    saveAs: false
  }, callback);
}

// Create Excel file with listing data
function createExcelFile(listingData, screenshotFilename, excelFilename, callback) {
  // Create workbook with SheetJS
  const wb = XLSX.utils.book_new();
  
  // Format data for Excel
  const data = [
    ["Title", "Price", "Location", "Date Posted", "Seller Name", "Listing URL", "Screenshot"],
    [
      listingData.title || "",
      listingData.price || "",
      listingData.location || "",
      listingData.datePosted || "",
      listingData.sellerName || "",
      listingData.url || "",
      `=HYPERLINK("./${screenshotFilename}", "Open Screenshot")`
    ]
  ];
  
  // Add vehicle details if available
  if (listingData.vehicleDetails && Object.keys(listingData.vehicleDetails).length > 0) {
    data[0].push("Year", "Make", "Model");
    data[1].push(
      listingData.vehicleDetails.year || "",
      listingData.vehicleDetails.make || "",
      listingData.vehicleDetails.model || ""
    );
  }
  
  // Create worksheet and add to workbook
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Listing");
  
  // Convert to binary Excel format
  const excelBinary = XLSX.write(wb, {bookType: 'xlsx', type: 'binary'});
  
  // Convert binary to Blob
  const buffer = new ArrayBuffer(excelBinary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < excelBinary.length; i++) {
    view[i] = excelBinary.charCodeAt(i) & 0xFF;
  }
  const blob = new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  
  // Save blob to file
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: excelFilename,
    saveAs: false
  }, callback);
}

// Helper function to sanitize filenames
function sanitizeFilename(filename) {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid filename characters
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .substring(0, 50);              // Limit length
}