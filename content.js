// Listen for messages from the popup or keyboard shortcut
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "captureListing") {
    captureListing()
      .then(data => {
        sendResponse({success: true, data: data});
      })
      .catch(error => {
        sendResponse({success: false, error: error.message});
      });
    return true; // Indicate we'll respond asynchronously
  }
});

// Function to capture the listing data and screenshot
async function captureListing() {
  try {
    // Extract listing data
    const listingData = extractListingData();
    
    // Take a screenshot
    const screenshotUrl = await takeScreenshot();
    
    // Generate a filename for the screenshot
    const screenshotFilename = generateScreenshotFilename(listingData);
    
    // Save the data to storage
    await saveListingData(listingData, screenshotUrl, screenshotFilename);
    
    return {
      listingData,
      screenshotFilename
    };
  } catch (error) {
    console.error("Error capturing listing:", error);
    throw error;
  }
}

// Extract data from the current listing page
function extractListingData() {
  // Initialize with default values
  let data = {
    title: "N/A",
    price: "N/A",
    location: "N/A",
    date: "N/A",
    vehicleInfo: {},
    listingUrl: window.location.href
  };
  
  try {
    // Title - typically the main heading of the page
    const titleElements = document.querySelectorAll("h1");
    if (titleElements.length > 0) {
      data.title = titleElements[0].textContent.trim();
    }
    
    // Price - look for elements with CA$ pattern
    const priceElements = Array.from(document.querySelectorAll("span"))
      .filter(span => span.textContent.includes("CA$"));
    if (priceElements.length > 0) {
      data.price = priceElements[0].textContent.trim();
    }
    
    // Location - look for province codes
    const locationElements = Array.from(document.querySelectorAll("span"))
      .filter(span => {
        const text = span.textContent;
        const provincePatterns = [", NB", ", NS", ", PE", ", NL", ", ON", ", QC", ", MB", ", SK", ", AB", ", BC"];
        return provincePatterns.some(pattern => text.includes(pattern));
      });
    if (locationElements.length > 0) {
      data.location = locationElements[0].textContent.trim();
    }
    
    // Date posted - look for "Listed X time ago" pattern
    const dateElements = Array.from(document.querySelectorAll("span"))
      .filter(span => span.textContent.includes("Listed") && span.textContent.includes("ago"));
    if (dateElements.length > 0) {
      data.date = dateElements[0].textContent.trim();
    }
    
    // Extract vehicle year, make, model from title
    const yearMatch = data.title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      data.vehicleInfo.year = yearMatch[0];
      
      // Common car makes for identification
      const carMakes = [
        'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick', 
        'Cadillac', 'Chevrolet', 'Chevy', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
        'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia',
        'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Mazda',
        'McLaren', 'Mercedes', 'Mercedes-Benz', 'Mercury', 'Mini', 'Mitsubishi', 'Nissan',
        'Porsche', 'Ram', 'Rolls-Royce', 'Saab', 'Saturn', 'Scion', 'Subaru', 'Suzuki',
        'Tesla', 'Toyota', 'Volkswagen', 'VW', 'Volvo'
      ];
      
      // Look for car make in title
      for (const make of carMakes) {
        if (data.title.toLowerCase().includes(make.toLowerCase())) {
          data.vehicleInfo.make = make;
          
          // Extract model (everything after make, excluding year)
          const titleParts = data.title.split(' ');
          const makeIndex = titleParts.findIndex(part => 
            part.toLowerCase() === make.toLowerCase() || 
            part.toLowerCase().includes(make.toLowerCase())
          );
          
          if (makeIndex !== -1 && makeIndex + 1 < titleParts.length) {
            const modelParts = titleParts.slice(makeIndex + 1);
            data.vehicleInfo.model = modelParts
              .filter(part => !part.match(/\b(19|20)\d{2}\b/))
              .join(' ');
          }
          
          break;
        }
      }
    }
    
    // Look for mileage info - find "Driven X km" pattern
    const mileageElements = Array.from(document.querySelectorAll("span"))
      .filter(span => span.textContent.includes("Driven") && span.textContent.includes("km"));
    if (mileageElements.length > 0) {
      data.vehicleInfo.mileage = mileageElements[0].textContent.trim();
    }
    
  } catch (error) {
    console.error("Error extracting listing data:", error);
  }
  
  return data;
}

// Take a screenshot of the current page
async function takeScreenshot() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({action: "takeScreenshot"}, function(response) {
      if (response && response.success) {
        resolve(response.screenshotUrl);
      } else {
        reject(new Error(response ? response.error : "Failed to take screenshot"));
      }
    });
  });
}

// Generate filename for screenshot based on listing data
function generateScreenshotFilename(listingData) {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const title = listingData.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  const price = listingData.price.replace(/[^a-z0-9]/gi, '');
  
  return `${date}_${title}_${price}.png`;
}

// Save listing data and screenshot to extension storage
async function saveListingData(listingData, screenshotUrl, screenshotFilename) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('listings', function(data) {
      const listings = data.listings || [];
      
      // Add new listing with formatted vehicle info
      const vehicleInfoStr = Object.entries(listingData.vehicleInfo)
        .filter(([key, value]) => value) // Filter out empty values
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      listings.push({
        title: listingData.title,
        price: listingData.price,
        location: listingData.location,
        date: listingData.date,
        vehicleInfo: vehicleInfoStr,
        listingUrl: listingData.listingUrl,
        screenshotUrl: screenshotUrl,
        screenshotFilename: screenshotFilename,
        capturedAt: new Date().toISOString()
      });
      
      // Save back to storage
      chrome.storage.local.set({listings}, function() {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}