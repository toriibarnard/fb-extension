document.addEventListener('DOMContentLoaded', function() {
  // Load saved options
  chrome.storage.sync.get(['saveLocation', 'bundleZip'], function(items) {
    if (items.saveLocation) {
      document.getElementById('saveLocation').value = items.saveLocation;
    }
    if (items.bundleZip !== undefined) {
      document.getElementById('bundleZip').checked = items.bundleZip;
    }
  });
  
  // Save options
  document.getElementById('saveOptions').addEventListener('click', function() {
    const saveLocation = document.getElementById('saveLocation').value;
    const bundleZip = document.getElementById('bundleZip').checked;
    
    chrome.storage.sync.set({
      saveLocation: saveLocation,
      bundleZip: bundleZip
    }, function() {
      const status = document.getElementById('optionsStatus');
      status.textContent = 'Options saved!';
      setTimeout(function() {
        status.textContent = '';
      }, 2000);
    });
  });

  // Capture button
  document.getElementById('captureBtn').addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      
      // Check if this is a Facebook Marketplace listing page
      if (!activeTab.url.includes('facebook.com/marketplace/item/')) {
        setStatus('Please open a Facebook Marketplace listing first!', 'error');
        return;
      }
      
      // Get options
      chrome.storage.sync.get(['saveLocation', 'bundleZip'], function(options) {
        const saveLocation = options.saveLocation || 'screenshots';
        const bundleZip = options.bundleZip !== undefined ? options.bundleZip : true;
        
        // Send message to content script to extract data
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'extractData',
          options: {
            saveLocation: saveLocation,
            bundleZip: bundleZip
          }
        }, function(response) {
          if (chrome.runtime.lastError) {
            setStatus('Error: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.success) {
            setStatus('Listing captured successfully!', 'success');
          } else {
            setStatus('Error capturing listing: ' + (response ? response.error : 'Unknown error'), 'error');
          }
        });
      });
    });
  });
  
  function setStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    setTimeout(function() {
      status.className = '';
    }, 3000);
  }
});