document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const autoAnalyzeToggle = document.getElementById('autoAnalyze');
    const notificationsToggle = document.getElementById('notifications');
    const analysisDepthSelect = document.getElementById('analysisDepth');
    const apiKeyInput = document.getElementById('apiKey');
    const confidenceThresholdInput = document.getElementById('confidenceThreshold');
    const debugModeToggle = document.getElementById('debugMode');
    const saveButton = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('statusMessage');

    // Load saved settings
    chrome.storage.sync.get({
        autoAnalyze: true,
        notifications: true,
        analysisDepth: 'standard',
        apiKey: '',
        confidenceThreshold: 75,
        debugMode: false
    }, (settings) => {
        // Populate form with saved settings
        autoAnalyzeToggle.checked = settings.autoAnalyze;
        notificationsToggle.checked = settings.notifications;
        analysisDepthSelect.value = settings.analysisDepth;
        apiKeyInput.value = settings.apiKey;
        confidenceThresholdInput.value = settings.confidenceThreshold;
        debugModeToggle.checked = settings.debugMode;
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        // Get values from form
        const newSettings = {
            autoAnalyze: autoAnalyzeToggle.checked,
            notifications: notificationsToggle.checked,
            analysisDepth: analysisDepthSelect.value,
            apiKey: apiKeyInput.value.trim(),
            confidenceThreshold: parseInt(confidenceThresholdInput.value, 10),
            debugMode: debugModeToggle.checked
        };

        // Save to Chrome storage
        chrome.storage.sync.set(newSettings, () => {
            // Show success message
            statusMessage.textContent = 'Settings saved successfully!';
            statusMessage.classList.add('success');
            statusMessage.style.display = 'block';

            // Notify content script about the settings change
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url.includes('tradingview.com')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateSettings',
                        settings: newSettings
                    });
                }
            });

            // Hide message after 2 seconds
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 2000);
        });
    });

    // Validate confidence threshold
    confidenceThresholdInput.addEventListener('input', () => {
        let value = parseInt(confidenceThresholdInput.value, 10);
        
        if (isNaN(value)) {
            confidenceThresholdInput.value = 75;
        } else {
            if (value < 0) confidenceThresholdInput.value = 0;
            if (value > 100) confidenceThresholdInput.value = 100;
        }
    });
}); 