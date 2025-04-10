/**
 * Candle - Chrome Extension Content Script
 * This script injects a sidebar iframe with the Candle Next.js app into TradingView
 * and handles bidirectional communication between the app and TradingView.
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    APP_URL: 'https://tiktrack.jaketrefethen.com',  // Replace with your Next.js app URL
    SIDEBAR_WIDTH: 380,                // Default sidebar width in pixels
    STORAGE_KEY: 'candle_sidebar_state',
    ALLOWED_ORIGINS: ['https://tiktrack.jaketrefethen.com']
  };

  // State
  let isSidebarVisible = true;
  let sidebarWidth = CONFIG.SIDEBAR_WIDTH;
  let resizing = false;
  let sidebarFrame = null;
  let isConnected = false;
  let chartData = null;
  let highlightedElements = {};
  let lastMessageId = 0;
  let pendingResponses = {};

  // DOM Elements
  let sidebar = null;
  let toggle = null;
  let resizeHandle = null;

  /**
   * Initialize the extension
   */
  function initialize() {
    console.log('Candle content script loaded');
    
    // Only run on TradingView
    if (!isTradingViewPage()) {
      return;
    }
    console.log('Candle detected TradingView page');

    // Set up interface
    setupInterface();

    // Listen for messages from the iframe
    window.addEventListener('message', handleFrameMessage, false);
  }

  /**
   * Check if current page is TradingView
   */
  function isTradingViewPage() {
    return window.location.hostname.includes('tradingview.com');
  }

  /**
   * Set up the sidebar interface
   */
  function setupInterface() {
    // Load saved state
    loadSidebarState();
    
    // Create sidebar container
    sidebar = document.createElement('div');
    sidebar.id = 'candle-sidebar';
    Object.assign(sidebar.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: sidebarWidth + 'px',
      height: '100%',
      zIndex: '9999',
      backgroundColor: '#1e1e2d',
      boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.5)',
      transition: 'transform 0.3s ease',
      transform: isSidebarVisible ? 'translateX(0)' : 'translateX(100%)'
    });
    document.body.appendChild(sidebar);

    // Create resize handle
    resizeHandle = document.createElement('div');
    resizeHandle.id = 'candle-resize-handle';
    Object.assign(resizeHandle.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '5px',
      height: '100%',
      cursor: 'ew-resize',
      zIndex: '10000'
    });
    sidebar.appendChild(resizeHandle);

    // Create toggle button
    toggle = document.createElement('button');
    toggle.id = 'candle-toggle';
    toggle.textContent = isSidebarVisible ? '›' : '‹';
    Object.assign(toggle.style, {
      position: 'fixed',
      top: '50%',
      right: isSidebarVisible ? (sidebarWidth - 1) + 'px' : '0',
      transform: 'translateY(-50%)',
      zIndex: '10001',
      backgroundColor: '#2962ff',
      color: 'white',
      border: 'none',
      borderRadius: '4px 0 0 4px',
      padding: '10px 5px',
      fontSize: '18px',
      cursor: 'pointer',
      boxShadow: '-2px 0 5px rgba(0, 0, 0, 0.3)',
      transition: 'right 0.3s ease'
    });
    document.body.appendChild(toggle);

    // Create and load iframe
    createIframe();
    
    // Set up event handlers
    setupEventHandlers();
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
    
    sidebar.appendChild(sidebarFrame);
  }

  /**
   * Set up event handlers for the sidebar
   */
  function setupEventHandlers() {
    // Toggle sidebar visibility
    toggle.addEventListener('click', toggleSidebar);

    // Handle resize
    resizeHandle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);

    // Save state on unload
    window.addEventListener('beforeunload', saveSidebarState);
    
  }

  /**
   * Toggle sidebar visibility
   */
  function toggleSidebar() {
    isSidebarVisible = !isSidebarVisible;
    
    sidebar.style.transform = isSidebarVisible ? 'translateX(0)' : 'translateX(100%)';
    toggle.style.right = isSidebarVisible ? (sidebarWidth - 1) + 'px' : '0';
    toggle.textContent = isSidebarVisible ? '›' : '‹';
    
    saveSidebarState();
    
    // Notify frame of visibility change
    if (isConnected && isSidebarVisible) {
      sendMessageToFrame('visibility-changed', { visible: true });
    }
  }

  /**
   * Start resize operation
   */
  function startResize(e) {
    resizing = true;
    e.preventDefault();
  }

  /**
   * Handle resize movement
   */
  function handleResize(e) {
    if (!resizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    
    // Limit minimum and maximum size
    if (newWidth >= 300 && newWidth <= 600) {
      sidebarWidth = newWidth;
      sidebar.style.width = sidebarWidth + 'px';
      toggle.style.right = isSidebarVisible ? (sidebarWidth - 1) + 'px' : '0';
    }
  }

  /**
   * End resize operation
   */
  function stopResize() {
    if (resizing) {
      resizing = false;
      saveSidebarState();
    }
  }

  /**
   * Save sidebar state to localStorage
   */
  function saveSidebarState() {
    const state = {
      visible: isSidebarVisible,
      width: sidebarWidth
    };
    
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save sidebar state:', e);
    }
  }

  /**
   * Load sidebar state from localStorage
   */
  function loadSidebarState() {
    try {
      const savedState = localStorage.getItem(CONFIG.STORAGE_KEY);
      
      if (savedState) {
        const state = JSON.parse(savedState);
        isSidebarVisible = state.visible;
        sidebarWidth = state.width || CONFIG.SIDEBAR_WIDTH;
      }
    } catch (e) {
      console.error('Failed to load sidebar state:', e);
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

    const { type, messageId, data } = event.data;

    console.log('Received message from frame:', messageId, type, data);
    
    
  }

  /**
   * Send message to the iframe
   */
  function sendMessageToFrame(type, data, expectResponse = false) {
    if (!sidebarFrame || !sidebarFrame.contentWindow) {
      return Promise.reject(new Error('Frame not available'));
    }
    
    const messageId = ++lastMessageId;
    
    sidebarFrame.contentWindow.postMessage({
      type,
      messageId,
      data
    }, CONFIG.APP_URL);

    console.log('Sent message to frame:', messageId, type, data);
    
    // if (expectResponse) {
    //   return new Promise((resolve, reject) => {
    //     pendingResponses[messageId] = { resolve, reject };
        
    //     // Timeout after 10 seconds
    //     setTimeout(() => {
    //       if (pendingResponses[messageId]) {
    //         reject(new Error('Response timeout'));
    //         delete pendingResponses[messageId];
    //       }
    //     }, 10000);
    //   });
    // }
    
    return Promise.resolve();
  }

  /**
   * EXAMPLES Handle request to get chart data
   */
  // function handleGetChartData(messageId) {
  //   try {
  //     // Extract chart data from TradingView
  //     // This is a simplified example - actual implementation would need to
  //     // access TradingView's chart data which requires more complex DOM interaction
  //     const chartData = {
  //       symbol: getChartSymbol(),
  //       timeframe: getChartTimeframe(),
  //       indicators: getChartIndicators(),
  //       timestamp: Date.now()
  //     };
      
  //     // Send response back
  //     sendMessageToFrame('chart-data-response', {
  //       success: true,
  //       chartData
  //     }, messageId);
      
  //   } catch (error) {
  //     sendMessageToFrame('chart-data-response', {
  //       success: false,
  //       error: error.message
  //     }, messageId);
  //   }
  // }

  // /**
  //  * Handle request to highlight an indicator
  //  */
  // function handleHighlightIndicator(data, messageId) {
  //   const { indicatorId, highlight, color } = data;
    
  //   try {
  //     // Find the indicator element - simplified example
  //     const indicatorElement = document.querySelector(`[data-indicator-id="${indicatorId}"]`);
      
  //     if (!indicatorElement) {
  //       throw new Error('Indicator element not found');
  //     }
      
  //     if (highlight) {
  //       // Highlight the indicator
  //       const originalBackground = indicatorElement.style.backgroundColor;
  //       indicatorElement.style.backgroundColor = color || '#2962ff';
  //       indicatorElement.style.boxShadow = '0 0 8px rgba(41, 98, 255, 0.8)';
        
  //       // Store for later unhighlighting
  //       highlightedElements[indicatorId] = {
  //         element: indicatorElement,
  //         originalBackground
  //       };
  //     } else if (highlightedElements[indicatorId]) {
  //       // Unhighlight
  //       const { element, originalBackground } = highlightedElements[indicatorId];
  //       element.style.backgroundColor = originalBackground;
  //       element.style.boxShadow = 'none';
  //       delete highlightedElements[indicatorId];
  //     }
      
  //     sendMessageToFrame('highlight-indicator-response', {
  //       success: true,
  //       indicatorId
  //     }, messageId);
      
  //   } catch (error) {
  //     sendMessageToFrame('highlight-indicator-response', {
  //       success: false,
  //       error: error.message,
  //       indicatorId
  //     }, messageId);
  //   }
  // }

  // /**
  //  * Handle request to observe a DOM element
  //  */
  // function handleObserveElement(data, messageId) {
  //   const { selector, observe } = data;
    
  //   try {
  //     // This is a simplified implementation
  //     // A full implementation would set up a MutationObserver
      
  //     const response = {
  //       success: true,
  //       selector,
  //       observing: observe
  //     };
      
  //     sendMessageToFrame('observe-element-response', response, messageId);
      
  //   } catch (error) {
  //     sendMessageToFrame('observe-element-response', {
  //       success: false,
  //       error: error.message,
  //       selector
  //     }, messageId);
  //   }
  // }

  // /**
  //  * Check for changes in the chart and notify the frame
  //  */
  // function checkChartChanges() {
  //   if (!isConnected || !isSidebarVisible) return;
    
  //   try {
  //     const newChartData = {
  //       symbol: getChartSymbol(),
  //       timeframe: getChartTimeframe(),
  //       indicators: getChartIndicators(),
  //       timestamp: Date.now()
  //     };
      
  //     // Check if chart data has changed
  //     if (hasChartDataChanged(chartData, newChartData)) {
  //       chartData = newChartData;
  //       sendMessageToFrame('chart-updated', { chartData });
  //     }
  //   } catch (error) {
  //     console.error('Error checking chart changes:', error);
  //   }
  // }

  // /**
  //  * Helper function to get the current chart symbol
  //  */
  // function getChartSymbol() {
  //   // Example implementation - would need to be adapted for actual TradingView DOM structure
  //   const symbolElement = document.querySelector('.chart-header__symbol');
  //   return symbolElement ? symbolElement.textContent.trim() : 'Unknown';
  // }

  // /**
  //  * Helper function to get the current chart timeframe
  //  */
  // function getChartTimeframe() {
  //   // Example implementation - would need to be adapted for actual TradingView DOM structure
  //   const timeframeElement = document.querySelector('.chart-header__timeframe');
  //   return timeframeElement ? timeframeElement.textContent.trim() : 'Unknown';
  // }

  // /**
  //  * Helper function to get the current chart indicators
  //  */
  // function getChartIndicators() {
  //   // Example implementation - would need to be adapted for actual TradingView DOM structure
  //   const indicators = [];
  //   const indicatorElements = document.querySelectorAll('.chart-header__indicators-item');
    
  //   indicatorElements.forEach((element, index) => {
  //     indicators.push({
  //       id: `indicator-${index}`,
  //       name: element.textContent.trim()
  //     });
  //   });
    
  //   return indicators;
  // }

  // /**
  //  * Check if chart data has changed significantly
  //  */
  // function hasChartDataChanged(oldData, newData) {
  //   if (!oldData) return true;
    
  //   // Check if symbol or timeframe changed
  //   if (oldData.symbol !== newData.symbol || oldData.timeframe !== newData.timeframe) {
  //     return true;
  //   }
    
  //   // Check if indicators changed
  //   if (oldData.indicators.length !== newData.indicators.length) {
  //     return true;
  //   }
    
  //   // Check if more than 30 seconds have passed
  //   if (newData.timestamp - oldData.timestamp > 30000) {
  //     return true;
  //   }
    
  //   return false;
  // }

  // Start the extension
  initialize();
})(); 