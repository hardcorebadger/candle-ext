// Popup script for Candle AI Trading Assistant

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const statusBox = document.getElementById('statusBox');
    const autoAnalyzeToggle = document.getElementById('autoAnalyze');
    const notificationsToggle = document.getElementById('notifications');
    const settingsBtn = document.getElementById('settingsBtn');
    
    // Check if we're on TradingView
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url && currentTab.url.includes('tradingview.com')) {
            statusBox.classList.remove('inactive');
            statusBox.classList.add('active');
            statusBox.textContent = 'Extension active - analyzing chart';
        }
    });
    
    // Load saved settings
    chrome.storage.sync.get({
        autoAnalyze: true,
        notifications: true
    }, function(items) {
        autoAnalyzeToggle.checked = items.autoAnalyze;
        notificationsToggle.checked = items.notifications;
    });
    
    // Save settings when toggled
    autoAnalyzeToggle.addEventListener('change', function() {
        chrome.storage.sync.set({
            autoAnalyze: autoAnalyzeToggle.checked
        });
        
        // Send message to content script to update settings
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updateSettings',
                settings: {
                    autoAnalyze: autoAnalyzeToggle.checked
                }
            });
        });
    });
    
    notificationsToggle.addEventListener('change', function() {
        chrome.storage.sync.set({
            notifications: notificationsToggle.checked
        });
    });
    
    // Open options page when settings button is clicked
    settingsBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });
});

// Helper function to check if extension is on TradingView
function checkIfOnTradingView() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const activeTab = tabs[0];
    const isOnTradingView = activeTab && activeTab.url && 
                            activeTab.url.includes('tradingview.com');
    
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    if (isOnTradingView) {
      statusIndicator.style.backgroundColor = '#4bae4f'; // Green
      statusText.textContent = 'Active on TradingView';
    } else {
      statusIndicator.style.backgroundColor = '#f44336'; // Red
      statusText.textContent = 'Not on TradingView';
    }
  });
}

// Helper function to send messages to the active tab
function sendMessageToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
} 