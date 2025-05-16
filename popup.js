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
          console.error("Error taking screenshot:", chrome.runtime.lastError);
          showError("Error: " + chrome.runtime.lastError.message);
          return;
        }
        
        if (!response) {
          console.error("No response from content script for screenshot request");
          showError("Error: Content script not responding. Please refresh the page and try again.");
          return;
        }
        
        statusText.textContent = 'Scraping data...';
        console.log("Screenshot pending, now scraping data...");
        
        // Step 2: Scrape data
        chrome.tabs.sendMessage(tabId, {action: "scrapeData"}, function(listingData) {
          if (chrome.runtime.lastError) {
            console.error("Error scraping data:", chrome.runtime.lastError);
            showError("Error scraping data: " + chrome.runtime.lastError.message);
            return;
          }
          
          if (!listingData) {
            console.error("No listing data returned from content script");
            showError("Error: Could not extract listing data. Please try again.");
            return;
          }
          
          statusText.textContent = 'Taking screenshot...';
          console.log("Data scraped:", listingData);
          
          // Now get the actual screenshot
          chrome.tabs.captureVisibleTab(function(screenshotDataUrl) {
            if (chrome.runtime.lastError) {
              console.error("Error capturing tab:", chrome.runtime.lastError);
              showError("Error capturing screenshot: " + chrome.runtime.lastError.message);
              return;
            }
            
            console.log("Screenshot captured, length:", screenshotDataUrl ? screenshotDataUrl.length : 0);
            statusText.textContent = 'Creating file...';
            
            // Step 3: Save screenshot and create file
            chrome.runtime.sendMessage({
              action: "processListing", 
              data: {
                screenshot: screenshotDataUrl,
                listingData: listingData
              }
            }, function(response) {
              console.log("Process listing response:", response);
              
              if (chrome.runtime.lastError) {
                console.error("Error processing listing:", chrome.runtime.lastError);
                showError("Error processing data: " + chrome.runtime.lastError.message);
                return;
              }
              
              if (!response || !response.success) {
                console.error("Processing failed:", response);
                showError("Error: Failed to save data. " + (response ? response.error : ""));
                return;
              }
              
              lastSavedFile = response.downloadId;
              
              // Show success
              status.classList.add('hidden');
              result.classList.remove('hidden');
              openFileBtn.classList.remove('hidden');
              resultText.textContent = `Listing saved successfully! Screenshot and CSV file saved in your Downloads folder.`;
            });
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