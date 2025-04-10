/**
 * Candle - Chrome Extension Content Script
 * This script injects a sidebar iframe with the Candle Next.js app into TradingView
 * and handles bidirectional communication between the app and TradingView.
 */

(function() {
  'use strict';


  // Configuration
  const CONFIG_PROD = {
    APP_URL: 'https://candle-app-delta.vercel.app',  // Replace with your Next.js app URL
    SIDEBAR_WIDTH: 380,                // Default sidebar width in pixels
    STORAGE_KEY: 'candle_sidebar_state',
    ALLOWED_ORIGINS: ['https://candle-app-delta.vercel.app']
  };

  const CONFIG_DEV = {
    APP_URL: 'http://localhost:3000',  // Replace with your Next.js app URL
    SIDEBAR_WIDTH: 380,                // Default sidebar width in pixels
    STORAGE_KEY: 'candle_sidebar_state',
    ALLOWED_ORIGINS: ['http://localhost:3000']
  };

  const CONFIG = CONFIG_DEV;

  // State
  let isSidebarVisible = true;
  let sidebarWidth = CONFIG.SIDEBAR_WIDTH;
  let resizing = false;
  let sidebarFrame = null;
  let isConnected = false;
  let lastRequestId = 0;
  let pendingResponses = {};

  // DOM Elements
  let sidebar = null;
  let toggle = null;
  let resizeHandle = null;

  

  /**
   * Initialize the extension
   */
  function initialize() {
    
    // Only run on TradingView
    if (!isTradingViewPage()) {
      return;
    }

    console.log('Candle extension initializing...');

    // Set up interface
    setupInterface();

    // Listen for messages from the iframe
    window.addEventListener('message', handleFrameMessage, false);
    console.log('Candle initialized.');

    
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
      sendRequest({ route: 'visibility-changed', data: { visible: true } });
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
    
    // Handle response packet
    if (packet.type === 'response') {
      const { requestId, data } = packet;
      if (pendingResponses[requestId]) {
        const { resolve } = pendingResponses[requestId];
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