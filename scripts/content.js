// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extractData') {
    try {
      const listingData = extractListingData();
      
      // Take a screenshot of the listing
      chrome.runtime.sendMessage({
        action: 'captureScreenshot',
        data: listingData,
        options: request.options
      }, function(response) {
        sendResponse(response);
      });
      
      return true; // Indicates we'll respond asynchronously
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
});

// Extract listing data from the current page
function extractListingData() {
  // Initialize data object
  const data = {
    title: 'N/A',
    price: 'N/A',
    location: 'N/A',
    date: 'N/A',
    vehicleInfo: {},
    listingUrl: window.location.href,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Extract title - typically a large header at the top
    const titleElements = document.querySelectorAll('h1');
    if (titleElements.length > 0) {
      data.title = titleElements[0].textContent.trim();
    }
    
    // Extract price - typically shown with currency symbol
    const priceElements = document.querySelectorAll('span[dir="auto"]');
    for (const elem of priceElements) {
      if (elem.textContent.includes('CA$')) {
        data.price = elem.textContent.trim();
        break;
      }
    }
    
    // Extract location
    const locationElements = document.querySelectorAll('span[dir="auto"]');
    for (const elem of locationElements) {
      const text = elem.textContent.trim();
      if (text.includes(', NS') || text.includes(', NB') || text.includes('Halifax') || 
          text.includes('Dartmouth') || text.includes('Sydney')) {
        data.location = text;
        break;
      }
    }
    
    // Extract date posted
    const dateElements = document.querySelectorAll('span');
    for (const elem of dateElements) {
      const text = elem.textContent.trim();
      if (text.includes('Listed') && text.includes('ago')) {
        data.date = text;
        break;
      }
    }
    
    // Extract vehicle information
    try {
      // Try to parse vehicle year, make, model from the title
      const yearMatch = data.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        data.vehicleInfo.year = yearMatch[0];
      }
      
      // Common car manufacturers
      const makes = [
        'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick', 
        'Cadillac', 'Chevrolet', 'Chevy', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
        'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia',
        'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Mazda',
        'McLaren', 'Mercedes', 'Mercedes-Benz', 'Mercury', 'Mini', 'Mitsubishi', 'Nissan',
        'Porsche', 'Ram', 'Rolls-Royce', 'Saab', 'Saturn', 'Scion', 'Subaru', 'Suzuki',
        'Tesla', 'Toyota', 'Volkswagen', 'VW', 'Volvo'
      ];
      
      for (const make of makes) {
        if (data.title.includes(make)) {
          data.vehicleInfo.make = make;
          
          // Try to extract model (text after make)
          const makeIndex = data.title.indexOf(make) + make.length;
          const modelText = data.title.substring(makeIndex).trim();
          if (modelText && data.vehicleInfo.year) {
            // Remove year from model if present
            data.vehicleInfo.model = modelText.replace(data.vehicleInfo.year, '').trim();
          } else {
            data.vehicleInfo.model = modelText;
          }
          
          break;
        }
      }
      
      // Extract mileage
      const mileageElements = document.querySelectorAll('span');
      for (const elem of mileageElements) {
        const text = elem.textContent.trim();
        if (text.includes('Driven') && text.includes('km')) {
          data.vehicleInfo.mileage = text;
          break;
        }
      }
      
      // Extract transmission
      const transmissionElements = document.querySelectorAll('span');
      for (const elem of transmissionElements) {
        const text = elem.textContent.trim();
        if (text.includes('transmission')) {
          data.vehicleInfo.transmission = text;
          break;
        }
      }
    } catch (error) {
      console.log('Error parsing vehicle info:', error);
    }
    
    return data;
  } catch (error) {
    console.error('Error extracting listing data:', error);
    throw error;
  }
}

// Add keyboard shortcut listener (Alt+C)
document.addEventListener('keydown', function(event) {
  if (event.altKey && event.key === 'c') {
    chrome.runtime.sendMessage({ action: 'triggerCapture' });
  }
});