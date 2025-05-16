document.addEventListener('DOMContentLoaded', function() {
  const captureBtn = document.getElementById('captureBtn');
  const status = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const result = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  const openFileBtn = document.getElementById('openFileBtn');
  
  let lastSavedFile = null;
  
  // Check if we're on a Facebook Marketplace listing
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (!currentTab.url.includes('facebook.com/marketplace')) {
      captureBtn.disabled = true;
      captureBtn.textContent = 'Not a Marketplace Page';
    }
  });
  
  // Capture button click handler
  captureBtn.addEventListener('click', function() {
    captureMarketplaceListing();
  });
  
  // Open file button click handler
  openFileBtn.addEventListener('click', function() {
    if (lastSavedFile) {
      chrome.downloads.open(lastSavedFile);
    }
  });
  
  // Capture function
  function captureMarketplaceListing() {
    status.classList.remove('hidden');
    result.classList.add('hidden');
    statusText.textContent = 'Taking screenshot...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const tabId = tabs[0].id;
      
      // Step 1: Take screenshot
      chrome.tabs.sendMessage(tabId, {action: "captureScreenshot"}, function(response) {
        if (chrome.runtime.lastError) {
          showError("Error: " + chrome.runtime.lastError.message);
          return;
        }
        
        if (!response) {
          showError("Error: No response from content script");
          return;
        }
        
        statusText.textContent = 'Scraping data...';
        
        // Step 2: Scrape data
        chrome.tabs.sendMessage(tabId, {action: "scrapeData"}, function(listingData) {
          if (chrome.runtime.lastError || !listingData) {
            showError("Error scraping data");
            return;
          }
          
          statusText.textContent = 'Creating Excel file...';
          
          // Step 3: Save screenshot and create Excel file
          chrome.runtime.sendMessage({
            action: "processListing", 
            data: {
              screenshot: response.screenshot,
              listingData: listingData
            }
          }, function(response) {
            if (chrome.runtime.lastError || !response || !response.success) {
              showError("Error processing data");
              return;
            }
            
            lastSavedFile = response.downloadId;
            
            // Show success
            status.classList.add('hidden');
            result.classList.remove('hidden');
            resultText.textContent = `Listing saved successfully! Screenshot and Excel file saved in your Downloads folder.`;
          });
        });
      });
    });
  }
  
  function showError(message) {
    status.classList.add('hidden');
    result.classList.remove('hidden');
    resultText.textContent = message;
    openFileBtn.classList.add('hidden');
  }
});