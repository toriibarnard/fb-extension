document.addEventListener('DOMContentLoaded', function() {
  const captureBtn = document.getElementById('captureBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  const listingCountSpan = document.getElementById('listingCount');
  
  // Update listing count
  updateListingCount();
  
  // Check if we're on a marketplace listing page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (!currentUrl.includes('facebook.com/marketplace')) {
      showStatus('Please navigate to a Facebook Marketplace listing', 'error');
      captureBtn.disabled = true;
    }
  });
  
  // Handle the capture button click
  captureBtn.addEventListener('click', function() {
    captureBtn.disabled = true;
    showStatus('Capturing listing...', 'success');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "captureListing"}, function(response) {
        if (response && response.success) {
          showStatus('Listing captured successfully!', 'success');
          updateListingCount();
        } else {
          showStatus('Error: ' + (response ? response.error : 'Unknown error'), 'error');
        }
        captureBtn.disabled = false;
      });
    });
  });
  
  // Handle the download button click
  downloadBtn.addEventListener('click', function() {
    downloadBtn.disabled = true;
    showStatus('Preparing download...', 'success');
    
    chrome.runtime.sendMessage({action: "downloadExcel"}, function(response) {
      if (response && response.success) {
        showStatus('Files downloading!', 'success');
      } else {
        showStatus('Error: ' + (response ? response.error : 'No listings to download'), 'error');
      }
      downloadBtn.disabled = false;
    });
  });
  
  // Handle the clear button click
  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all saved listings?')) {
      chrome.storage.local.set({listings: []}, function() {
        showStatus('All listings cleared', 'success');
        updateListingCount();
      });
    }
  });
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.classList.remove('hidden');
    
    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 3000);
  }
  
  function updateListingCount() {
    chrome.storage.local.get('listings', function(data) {
      const listings = data.listings || [];
      listingCountSpan.textContent = listings.length;
      
      // Disable download button if no listings
      downloadBtn.disabled = listings.length === 0;
    });
  }
});