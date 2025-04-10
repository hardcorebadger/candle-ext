/**
 * Candle - Chrome Extension Background Script
 * Handles screenshot capturing and other background tasks
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureScreenshot') {
    captureScreenshot(sender.tab.id)
      .then(dataUrl => {
        sendResponse({ success: true, image: dataUrl });
      })
      .catch(error => {
        console.error('Error capturing screenshot:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

/**
 * Capture a screenshot of the current tab
 * @param {number} tabId - The ID of the tab to capture
 * @returns {Promise<string>} A promise that resolves with the screenshot as a data URL
 */
async function captureScreenshot(tabId) {
  // Use the chrome.tabs.captureVisibleTab API to take a screenshot
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null, // Capture the active window
      { format: 'png' },
      dataUrl => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(dataUrl);
        }
      }
    );
  });
} 