/**
 * Candle - Chrome Extension Content Script
 * This script injects a button into TradingView's sidebar tab bar and loads
 * the Candle Next.js app iframe when the button is clicked.
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG_PROD = {
    APP_URL: 'https://candle-app-delta.vercel.app',  // Replace with your Next.js app URL
    STORAGE_KEY: 'candle_sidebar_state',
    ALLOWED_ORIGINS: ['https://candle-app-delta.vercel.app']
  };

  const CONFIG_DEV = {
    APP_URL: 'http://localhost:3000',  // Replace with your Next.js app URL
    STORAGE_KEY: 'candle_sidebar_state',
    ALLOWED_ORIGINS: ['http://localhost:3000']
  };

  const CONFIG = CONFIG_DEV;

  // State
  let isActive = false;
  let isConnected = false;
  let lastRequestId = 0;
  let pendingResponses = {};
  let candleButton = null;
  let sidebarFrame = null;
  let candlePanel = null;
  let originalPanelContent = null;
  let previousActiveButton = null; // Store the previously active button
  let originalPanelStyle = null; // Store original panel styles
  
  // DOM selectors
  const SELECTORS = {
    tabBar: '.widgetbar-tabs .toolbar-S4V6IoxY',
    panelContainer: '.widgetbar-pages',
    button: '.button-I_wb5FjE.apply-common-tooltip.common-tooltip-vertical.accessible-I_wb5FjE',
    defaultPanelContent: '.widgetbar-pagescontent',
    activeButtonClass: 'isActive-I_wb5FjE',
    widgetBar: '.widgetbar-widget',
    resizeHandle: '.widgetbar-resizer' // The resize handle element
  };

  /**
   * Initialize the extension
   */
  function initialize() {
    // Only run on TradingView
    if (!isTradingViewPage()) {
      return;
    }

    console.log('Candle extension initializing...');

    // Wait for TradingView UI to fully load
    waitForElement(SELECTORS.tabBar).then(() => {
      // Set up interface
      setupInterface();

      // Listen for messages from the iframe
      window.addEventListener('message', handleFrameMessage, false);
      console.log('Candle initialized.');
    });
  }

  /**
   * Wait for an element to be available in the DOM
   * @param {string} selector - CSS selector for the element
   * @returns {Promise} - Resolves when the element is found
   */
  function waitForElement(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(mutations => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  /**
   * Check if current page is TradingView
   */
  function isTradingViewPage() {
    return window.location.hostname.includes('tradingview.com');
  }

  /**
   * Set up the interface by adding a button to TradingView's tab bar
   */
  function setupInterface() {
    // Find and store reference to the original panel content
    originalPanelContent = document.querySelector(SELECTORS.defaultPanelContent);

    // Store original panel styles
    storeOriginalPanelState();
    
    // Create our panel that will contain the iframe
    createCandlePanel();
    
    // Create and add our button to the tab bar
    createCandleButton();
    
    // Create the iframe inside our panel
    createIframe();
    
    // Add event listeners to other buttons in the tab bar
    addTabBarButtonListeners();
    
    // Also keep the mutation observer as a fallback
    observePanelContainer();
  }

  /**
   * Store the original panel state to restore it later
   */
  function storeOriginalPanelState() {
    // Capture the widget bar that contains the resize functionality
    const widgetBar = document.querySelector(SELECTORS.widgetBar);
    if (widgetBar) {
      // Store the original style attributes
      originalPanelStyle = {
        width: widgetBar.style.width || '',
        minWidth: widgetBar.style.minWidth || '',
        maxWidth: widgetBar.style.maxWidth || '',
        classList: [...widgetBar.classList]
      };
    }
  }

  /**
   * Create the Candle panel that will contain our iframe
   */
  function createCandlePanel() {
    candlePanel = document.createElement('div');
    candlePanel.id = 'candle-panel';
    candlePanel.classList.add('widgetbar-pagescontent'); // Add the same class for consistency
    candlePanel.style.width = '100%';
    candlePanel.style.height = '100%';
    candlePanel.style.display = 'none'; // Initially hidden
    
    // Wait for panel container to be available
    waitForElement(SELECTORS.panelContainer).then(panelContainer => {
      panelContainer.appendChild(candlePanel);
    });
  }

  /**
   * Create and add our button to TradingView's tab bar
   */
  function createCandleButton() {
    const tabBar = document.querySelector(SELECTORS.tabBar);
    if (!tabBar) {
      console.error('Could not find TradingView tab bar');
      return;
    }

    // Clone an existing button to match TradingView's style
    const existingButton = document.querySelector(SELECTORS.button);
    if (!existingButton) {
      console.error('Could not find existing button to clone');
      return;
    }

    candleButton = existingButton.cloneNode(true);
    
    // Update button properties
    candleButton.setAttribute('data-name', 'candle');
    candleButton.setAttribute('data-tooltip', 'Candle Assistant');
    candleButton.setAttribute('aria-label', 'Candle Assistant');
    
    // Update button icon - Replace with Candle icon
    const iconSpan = candleButton.querySelector('span[role="img"]');
    if (iconSpan) {
      iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path fill="currentColor" d="M12,2C6.5,2,2,6.5,2,12c0,5.5,4.5,10,10,10s10-4.5,10-10C22,6.5,17.5,2,12,2z M16,16.2c0,0.6-0.5,1-1,1h-6c-0.6,0-1-0.5-1-1v-0.8c0-0.3,0.1-0.5,0.4-0.7l1.5-1c0.7-0.5,1.3-1.1,1.7-1.9c0.1-0.2,0.4-0.4,0.7-0.4h0.8c0.3,0,0.5,0.1,0.7,0.4c0.4,0.8,1,1.4,1.7,1.9l1.5,1c0.2,0.2,0.4,0.4,0.4,0.7V16.2z M14,8.5L12,7L10,8.5V10h4V8.5z"/>
      </svg>`;
    }
    
    // Add click handler
    candleButton.addEventListener('click', toggleCandlePanel);
    
    // Add to tab bar
    tabBar.appendChild(candleButton);
  }

  /**
   * Add event listeners to other buttons in the tab bar
   */
  function addTabBarButtonListeners() {
    const tabBar = document.querySelector(SELECTORS.tabBar);
    if (!tabBar) return;
    
    // Get all buttons in the tab bar (excluding our button)
    const updateButtonListeners = () => {
      const buttons = tabBar.querySelectorAll(SELECTORS.button);
      
      buttons.forEach(button => {
        // Skip our own button
        if (button === candleButton || button.getAttribute('data-name') === 'candle') {
          return;
        }
        
        // Remove existing listener if present (to avoid duplicates)
        button.removeEventListener('click', handleOtherButtonClick);
        
        // Add click listener
        button.addEventListener('click', handleOtherButtonClick);
      });
    };
    
    // Initial setup
    updateButtonListeners();
    
    // Also observe the tab bar for new buttons being added
    const observer = new MutationObserver(() => {
      updateButtonListeners();
    });
    
    observer.observe(tabBar, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Handle click on other buttons in the tab bar
   * @param {Event} event - The click event
   */
  function handleOtherButtonClick(event) {
    // If our panel is currently active, deactivate it
    if (isActive) {
      event.stopPropagation(); // Prevent TradingView's handler from running
      event.preventDefault();
      
      isActive = false;
      
      // Remove active class from our button
      candleButton.classList.remove(SELECTORS.activeButtonClass);
      candleButton.setAttribute('aria-pressed', 'false');
      
      // Add active class to the clicked button
      const clickedButton = event.currentTarget;
      clickedButton.classList.add(SELECTORS.activeButtonClass);
      
      // Hide our panel and show the appropriate panel
      hideCandlePanel();
      
      // If this is the previously active button, restore its state
      if (previousActiveButton === clickedButton) {
        // Re-apply active state to the previously active button
        previousActiveButton.classList.add(SELECTORS.activeButtonClass);
        previousActiveButton.setAttribute('aria-pressed', 'true');
        
        // Make sure its panel is shown
        const defaultPanelContent = document.querySelector(SELECTORS.defaultPanelContent);
        if (defaultPanelContent && defaultPanelContent !== candlePanel) {
          defaultPanelContent.style.display = 'block';
        }
        
        // Ensure resize functionality still works
        restoreResizeFunctionality();
      } else {
        // Let the button's native click handler run after we've done our cleanup
        setTimeout(() => {
          clickedButton.click();
          // Ensure resize functionality still works
          restoreResizeFunctionality();
        }, 0);
      }
      
      // Notify frame of visibility change
      if (isConnected) {
        sendRequest({ route: 'visibility-changed', data: { visible: false } });
      }
    }
  }

  /**
   * Create the iframe for the Candle app
   */
  function createIframe() {
    sidebarFrame = document.createElement('iframe');
    sidebarFrame.id = 'candle-frame';
    sidebarFrame.src = CONFIG.APP_URL;
    Object.assign(sidebarFrame.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      backgroundColor: '#1e1e2d'
    });
    
    candlePanel.appendChild(sidebarFrame);
  }

  /**
   * Toggle the Candle panel's visibility
   */
  function toggleCandlePanel() {
    // Check if our panel is currently active
    isActive = !isActive;
    
    // Update button state
    candleButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    
    if (isActive) {
      // Find the currently active button and remember it
      const activeButton = document.querySelector(`.${SELECTORS.activeButtonClass}`);
      if (activeButton && activeButton !== candleButton) {
        previousActiveButton = activeButton;
        
        // Remove active class from the previously active button
        activeButton.classList.remove(SELECTORS.activeButtonClass);
        activeButton.setAttribute('aria-pressed', 'false');
      }
      
      // Add active class to our button
      candleButton.classList.add(SELECTORS.activeButtonClass);
      
      // Show our panel and hide others
      showCandlePanel();
    } else {
      // Remove active class from our button
      candleButton.classList.remove(SELECTORS.activeButtonClass);
      
      // Restore active class to the previously active button if there was one
      if (previousActiveButton) {
        previousActiveButton.classList.add(SELECTORS.activeButtonClass);
        previousActiveButton.setAttribute('aria-pressed', 'true');
      }
      
      // Hide our panel
      hideCandlePanel();
      
      // Ensure resize functionality is restored
      restoreResizeFunctionality();
    }
    
    // Notify frame of visibility change
    if (isConnected && isActive) {
      sendRequest({ route: 'visibility-changed', data: { visible: true } });
    }
  }

  /**
   * Restore the resize functionality of the panel
   */
  function restoreResizeFunctionality() {
    // Target the widget bar element
    const widgetBar = document.querySelector(SELECTORS.widgetBar);
    const resizeHandle = document.querySelector(SELECTORS.resizeHandle);
    
    if (widgetBar && originalPanelStyle) {
      // Re-apply original styles to ensure resize functionality works
      if (originalPanelStyle.width) {
        widgetBar.style.width = originalPanelStyle.width;
      }
      if (originalPanelStyle.minWidth) {
        widgetBar.style.minWidth = originalPanelStyle.minWidth;
      }
      if (originalPanelStyle.maxWidth) {
        widgetBar.style.maxWidth = originalPanelStyle.maxWidth;
      }
      
      // Ensure all original classes are present
      if (originalPanelStyle.classList) {
        originalPanelStyle.classList.forEach(cls => {
          if (!widgetBar.classList.contains(cls)) {
            widgetBar.classList.add(cls);
          }
        });
      }
    }
    
    // Ensure the resize handle is visible and working
    if (resizeHandle) {
      resizeHandle.style.display = 'block';
      resizeHandle.style.pointerEvents = 'auto';
      
      // Force a small DOM change to trigger any internal handlers
      setTimeout(() => {
        const currentDisplay = resizeHandle.style.display;
        resizeHandle.style.display = 'none';
        // Force reflow
        void resizeHandle.offsetWidth;
        resizeHandle.style.display = currentDisplay;
      }, 50);
    }
    
    // Sometimes TradingView initializes resize handlers on hover
    // Simulate a mouseover on the handle to ensure it's activated
    if (resizeHandle) {
      const mouseoverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      resizeHandle.dispatchEvent(mouseoverEvent);
    }
  }

  /**
   * Show the Candle panel and hide other panels
   */
  function showCandlePanel() {
    // Find the current pagescontent element (could have been updated since initialization)
    const defaultPanelContent = document.querySelector(SELECTORS.defaultPanelContent);
    
    // Before hiding the default content, capture its current state again
    storeOriginalPanelState();
    
    // Hide the default TradingView panel content if it exists
    if (defaultPanelContent && defaultPanelContent !== candlePanel) {
      defaultPanelContent.style.display = 'none';
    }
    
    // Show our panel
    candlePanel.style.display = 'block';
    
    // Make sure any other children in the panel container are hidden
    const panelContainer = document.querySelector(SELECTORS.panelContainer);
    if (panelContainer) {
      Array.from(panelContainer.children).forEach(child => {
        if (child !== candlePanel && !child.classList.contains('widgetbar-pagescontent')) {
          child.style.display = 'none';
        }
      });
    }
  }

  /**
   * Hide the Candle panel
   */
  function hideCandlePanel() {
    // Hide our panel
    candlePanel.style.display = 'none';
    
    // Restore default panel content
    const defaultPanelContent = document.querySelector(SELECTORS.defaultPanelContent);
    if (defaultPanelContent && defaultPanelContent !== candlePanel) {
      defaultPanelContent.style.display = 'block';
    } else {
      // If we can't find the default content, try to find any other panel that should be visible
      const panelContainer = document.querySelector(SELECTORS.panelContainer);
      if (panelContainer) {
        // Check if there is an active button
        const activeButton = document.querySelector(SELECTORS.button + '.' + SELECTORS.activeButtonClass);
        if (activeButton && activeButton !== candleButton) {
          // There's an active button, so there should be a corresponding panel
          // We'll re-click it to ensure the panel is shown
          setTimeout(() => {
            activeButton.click();
            // Make sure resize functionality is working
            restoreResizeFunctionality();
          }, 0);
        } else if (previousActiveButton) {
          // Use the previously active button
          setTimeout(() => {
            previousActiveButton.click();
            // Make sure resize functionality is working
            restoreResizeFunctionality();
          }, 0);
        } else {
          // If no active button, create a temporary default content
          const tempContent = document.createElement('div');
          tempContent.classList.add('widgetbar-pagescontent');
          tempContent.style.display = 'block';
          panelContainer.appendChild(tempContent);
          
          // Make sure resize functionality is working
          restoreResizeFunctionality();
        }
      }
    }
  }

  /**
   * Observe changes to panel container to handle when other panels are shown
   * This is kept as a fallback method
   */
  function observePanelContainer() {
    const panelContainer = document.querySelector(SELECTORS.panelContainer);
    if (!panelContainer) return;
    
    const observer = new MutationObserver(mutations => {
      // Look specifically for changes to the default panel content
      const defaultPanelContent = document.querySelector(SELECTORS.defaultPanelContent);
      
      // If there's a default panel visible (not our panel) and our panel is active, deactivate ours
      if (defaultPanelContent && 
          defaultPanelContent !== candlePanel && 
          window.getComputedStyle(defaultPanelContent).display !== 'none' && 
          isActive) {
        
        isActive = false;
        candleButton.classList.remove(SELECTORS.activeButtonClass);
        candleButton.setAttribute('aria-pressed', 'false');
        
        // Restore the previously active button if there was one
        if (previousActiveButton) {
          previousActiveButton.classList.add(SELECTORS.activeButtonClass);
          previousActiveButton.setAttribute('aria-pressed', 'true');
        }
        
        hideCandlePanel();
        
        // Notify frame of visibility change
        if (isConnected) {
          sendRequest({ route: 'visibility-changed', data: { visible: false } });
        }
      }
    });
    
    observer.observe(panelContainer, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  // Transport Layer
  function sendPacket(packet) {
      if (!sidebarFrame || !sidebarFrame.contentWindow) {
        throw new Error('Frame not available');
      }
      sidebarFrame.contentWindow.postMessage(packet, CONFIG.APP_URL);
  }

  // Request/Response Layer
  async function sendRequest(request, timeout = 10000) {
      const requestId = ++lastRequestId;
      const packet = {
        type: 'request',
        from: 'js',
        requestId,
        data: request
      };
      
      sendPacket(packet);

      return new Promise((resolve, reject) => {
        pendingResponses[requestId] = { resolve, reject };
        
        setTimeout(() => {
          if (pendingResponses[requestId]) {
            reject(new Error('Response timeout'));
            delete pendingResponses[requestId];
          }
        }, timeout);
      });
  }

  // Request Handler
  async function handleRequest(request) {
    console.log('JS Received request:', request);
    switch (request.route) {
      case 'debug':
        return {
          success: true,
          body: 'success'
        };
      case 'set-timeframe':
        return handleSetTimeframe(request.body);
      case 'add-indicator':
        return await handleAddIndicator(request.body);
      case "grab-screen":
        return await handleGrabScreen(request.body);
      
      default:
        return {
          success: false,
          error: 'Not found'
        }
    }
  }

  function handleSetTimeframe(body) {
    // console.log('Setting timeframe to:', body.timeframe);
    // find all buttons with class ".item-SqYYy1zF"
    const buttons = document.querySelectorAll('.item-SqYYy1zF');
    // console.log('Button count:', buttons.length);
    let buttonFound = false;
    buttons.forEach(button => {
      // console.log('Button:', button.textContent);
      // find the one whose text is the timeframe
      if (button.textContent === body.timeframe) {
        button.click();
        buttonFound = true;
        return;
      }
    });
    if (!buttonFound) {
      return {
        success: false,
        error:new Error('Timeframe not found')
      }
    }
    return {
      success: true,
      body: {
        timeframe: body.timeframe
      }
    }
  }

  async function handleAddIndicator(body) {
    console.log('Adding indicator:', body.indicator);
    // find the buttons with class ".button-ptpAHg8E.withText-ptpAHg8E"
    const buttons = document.querySelectorAll('.button-ptpAHg8E.withText-ptpAHg8E');
    // console.log('Button count:', buttons.length);
    const indicatorsButton = Array.from(buttons).find(button => button.textContent === "Indicators");
    if (!indicatorsButton) {
      return {
        success: false,
        error: new Error('Indicators button not found')
      }
    }
    indicatorsButton.click();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // type out the indicator name
    const input = document.querySelector('.input-qm7Rg5MB');
    input.value = body.indicator;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 1000));

    // find the divs with class ".container-WeNdU0sq"
    const containers = document.querySelectorAll('.container-WeNdU0sq');
    // console.log('Container count:', containers.length);
    const rsiContainer = Array.from(containers).find(container => container.textContent === "Relative Strength Index");
    if (!rsiContainer) {
      return {
        success: false,
        error: new Error('Relative Strength Index container not found')
      }
    }
    rsiContainer.click();

    // hit the close button on the dialog. find the button with class ".close-BZKENkhT"
    const closeButton = document.querySelector('.close-BZKENkhT');
    closeButton.click();

    return {
      success: true,
      body: {
        indicator: body.indicator
      }
    }
  }

  async function handleGrabScreen(body) {
    console.log('Grabbing screen');
    
    try {
      // Request screenshot from background script
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'captureScreenshot' },
          response => {
            if (response && response.success) {
              resolve({
                success: true,
                body: {
                  image: response.image
                }
              });
            } else {
              resolve({
                success: false,
                error: (response && response.error) || 'Failed to capture screenshot'
              });
            }
          }
        );
      });
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      return {
        success: false,
        error: error.message || 'Failed to capture screenshot'
      };
    }
  }

  /**
   * Handle messages from the iframe
   */
  function handleFrameMessage(event) {
    // Security check
    if (!CONFIG.ALLOWED_ORIGINS.includes(event.origin)) {
      return;
    }

    const packet = event.data;
    
    // Connection packet
    if (packet.type === 'connect') {
      isConnected = true;
      console.log('Connected to Candle app');
      return;
    }
    
    // Handle response packet
    if (packet.type === 'response') {
      const { requestId, data } = packet;
      if (pendingResponses[requestId]) {
        const { resolve, reject } = pendingResponses[requestId];
        const { success, error, body } = data;
        if (success) {
          resolve(body);
        } else {
          reject(new Error(error || 'Unknown error'));
        }
        delete pendingResponses[requestId];
      }
      return;
    }

    // Handle request packet
    if (packet.type === 'request') {
      const { requestId, data } = packet;
      handleRequest(data).then(response => {
        console.log("content.js responding to request:", requestId, data, response);
        sendPacket({
          type: 'response',
          from: 'js',
          requestId,
          data: response
        });
      });
    }
  }

  // Start the extension
  initialize();
})(); 