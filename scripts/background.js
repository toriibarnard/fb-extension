// Load required libraries
importScripts('../lib/xlsx.full.min.js', '../lib/jszip.min.js');

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'captureScreenshot') {
    captureScreenshot(request.data, request.options, sendResponse);
    return true; // Indicates we'll respond asynchronously
  } else if (request.action === 'triggerCapture') {
    // Trigger capture when keyboard shortcut is used
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('facebook.com/marketplace/item/')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'extractData',
          options: {
            saveLocation: 'screenshots',
            bundleZip: true
          }
        });
      }
    });
  }
});

// Capture screenshot and process listing data
function captureScreenshot(listingData, options, sendResponse) {
  chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    
    try {
      // Create a filename for the screenshot based on the listing data
      const date = new Date().toISOString().split('T')[0];
      const title = listingData.title.replace(/[^\w\s]/gi, '').substring(0, 30);
      const price = listingData.price.replace(/[^\w\s]/gi, '');
      const screenshotFilename = `${date}_${title}_${price}.png`;
      
      // Load existing Excel file or create new one
      loadExistingExcelOrCreateNew(function(workbook) {
        // Get the first worksheet, or create if it doesn't exist
        let worksheet = workbook.Sheets['Listings'];
        if (!worksheet) {
          workbook.SheetNames.push('Listings');
          worksheet = workbook.Sheets['Listings'] = {};
        }
        
        // Convert worksheet to JSON
        let worksheetData = XLSX.utils.sheet_to_json(worksheet) || [];
        
        // Format vehicle info for Excel
        let vehicleInfoStr = '';
        if (listingData.vehicleInfo) {
          const info = listingData.vehicleInfo;
          if (info.year) vehicleInfoStr += `Year: ${info.year} `;
          if (info.make) vehicleInfoStr += `Make: ${info.make} `;
          if (info.model) vehicleInfoStr += `Model: ${info.model} `;
          if (info.mileage) vehicleInfoStr += `${info.mileage} `;
          if (info.transmission) vehicleInfoStr += `${info.transmission}`;
        }
        
        // Add the new listing data
        worksheetData.push({
          'Title': listingData.title,
          'Price': listingData.price,
          'Location': listingData.location,
          'Date Posted': listingData.date,
          'Vehicle Info': vehicleInfoStr.trim(),
          'Listing URL': listingData.listingUrl,
          'Screenshot': `${options.saveLocation}/${screenshotFilename}`,
          'Captured On': new Date().toLocaleString()
        });
        
        // Convert JSON back to worksheet
        const newWorksheet = XLSX.utils.json_to_sheet(worksheetData);
        workbook.Sheets['Listings'] = newWorksheet;
        
        // Generate Excel file
        const excelOutput = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        if (options.bundleZip) {
          // Create a ZIP file with the Excel and screenshot
          const zip = new JSZip();
          zip.file('marketplace_listings.xlsx', excelOutput);
          
          // Extract base64 data from dataUrl
          const base64Data = dataUrl.split(',')[1];
          zip.file(`${options.saveLocation}/${screenshotFilename}`, base64Data, { base64: true });
          
          // Generate ZIP file
          zip.generateAsync({ type: 'blob' }).then(function(content) {
            // Download ZIP file
            const zipUrl = URL.createObjectURL(content);
            chrome.downloads.download({
              url: zipUrl,
              filename: `marketplace_capture_${date}.zip`,
              saveAs: false
            }, function(downloadId) {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true });
              }
            });
          });
        } else {
          // Download Excel file
          const excelBlob = new Blob([excelOutput], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const excelUrl = URL.createObjectURL(excelBlob);
          
          chrome.downloads.download({
            url: excelUrl,
            filename: 'marketplace_listings.xlsx',
            saveAs: false
          });
          
          // Download screenshot
          chrome.downloads.download({
            url: dataUrl,
            filename: `${options.saveLocation}/${screenshotFilename}`,
            saveAs: false
          }, function(downloadId) {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error processing data:', error);
      sendResponse({ success: false, error: error.message });
    }
  });
}

// Load existing Excel file or create a new one
function loadExistingExcelOrCreateNew(callback) {
  chrome.downloads.search({ 
    query: ['marketplace_listings.xlsx'], 
    exists: true,
    limit: 1 
  }, function(results) {
    if (results && results.length > 0) {
      // Try to load the existing file
      fetch(results[0].url)
        .then(response => response.arrayBuffer())
        .then(data => {
          try {
            const workbook = XLSX.read(data, { type: 'array' });
            callback(workbook);
          } catch (error) {
            // If the file is corrupted or can't be read, create new
            console.log('Could not read existing Excel file, creating new one');
            createNewWorkbook(callback);
          }
        })
        .catch(error => {
          console.log('Error loading existing Excel file, creating new one:', error);
          createNewWorkbook(callback);
        });
    } else {
      // Create a new workbook
      createNewWorkbook(callback);
    }
  });
}

// Create a new Excel workbook
function createNewWorkbook(callback) {
  const workbook = XLSX.utils.book_new();
  workbook.SheetNames.push('Listings');
  
  // Create headers
  const worksheet = XLSX.utils.json_to_sheet([{
    'Title': '',
    'Price': '',
    'Location': '',
    'Date Posted': '',
    'Vehicle Info': '',
    'Listing URL': '',
    'Screenshot': '',
    'Captured On': ''
  }]);
  
  workbook.Sheets['Listings'] = worksheet;
  callback(workbook);
}