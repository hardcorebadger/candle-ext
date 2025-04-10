/**
 * extension-client.js
 * 
 * This file demonstrates how a Next.js app would interact with the Chrome extension.
 * You can import or include this in your Next.js components to communicate with the extension.
 */

// Extension communication manager
const CandleExtension = {
  // Event handler registry
  eventHandlers: {},
  
  // Track if we're connected to the extension
  isConnected: false,
  
  // Track if we're running in an iframe
  isInIframe: false,
  
  /**
   * Initialize the extension client
   * Call this once when your app loads
   */
  init: function() {
    // Check if we're in an iframe (extension context)
    this.isInIframe = window !== window.top;
    
    // Set up message listener
    window.addEventListener('message', this._handleExtensionMessage.bind(this));
    
    // If we're in an iframe, send ready signal to the extension
    if (this.isInIframe) {
      this.sendMessage('webapp-loaded', {
        version: '1.0.0',
        capabilities: ['chart-analysis', 'indicator-highlighting']
      });
      
      console.log('Candle extension client initialized in iframe mode');
    } else {
      console.log('Candle extension client initialized in standalone mode');
    }
    
    return this;
  },
  
  /**
   * Register an event handler for messages from the extension
   * @param {string} eventName - Name of the event to listen for
   * @param {function} callback - Function to call when event is received
   */
  onMessage: function(eventName, callback) {
    this.eventHandlers[eventName] = callback;
    return this;
  },
  
  /**
   * Send a message to the extension
   * @param {string} eventName - Name of the event
   * @param {object} data - Data to send with the event
   */
  sendMessage: function(eventName, data = {}) {
    if (!this.isInIframe) {
      console.warn('Cannot send message to extension: not running in iframe');
      return this;
    }
    
    const message = {
      source: 'candle-webapp',
      event: eventName,
      data: data
    };
    
    window.parent.postMessage(message, '*');
    console.log(`Sent message to extension: ${eventName}`, data);
    
    return this;
  },
  
  /**
   * Handle messages from the extension
   * @private
   */
  _handleExtensionMessage: function(event) {
    const message = event.data;
    
    // Validate message format
    if (!message || !message.event || !message.source || message.source !== 'candle-extension') {
      return;
    }
    
    console.log(`Received message from extension: ${message.event}`, message.data);
    
    // Special handling for connection event
    if (message.event === 'extension-ready') {
      this.isConnected = true;
      
      // Notify any listeners about connection
      if (this.eventHandlers['extension-connected']) {
        this.eventHandlers['extension-connected'](message.data);
      }
    }
    
    // Route message to appropriate handler
    const handler = this.eventHandlers[message.event];
    if (handler && typeof handler === 'function') {
      handler(message.data);
    }
  },
  
  /**
   * Request chart data from TradingView
   * @returns {Promise} Promise that resolves with chart data
   */
  getChartData: function() {
    return new Promise((resolve, reject) => {
      if (!this.isInIframe) {
        reject(new Error('Not running in extension context'));
        return;
      }
      
      // Set up a one-time event handler for the response
      const responseHandler = (data) => {
        // Remove the handler after receiving response
        delete this.eventHandlers['chart-data'];
        resolve(data);
      };
      
      // Register handler for the response
      this.onMessage('chart-data', responseHandler);
      
      // Request the data
      this.sendMessage('get-chart-data');
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (this.eventHandlers['chart-data'] === responseHandler) {
          delete this.eventHandlers['chart-data'];
          reject(new Error('Timeout waiting for chart data'));
        }
      }, 5000);
    });
  },
  
  /**
   * Highlight an indicator on the chart
   * @param {string} indicator - Indicator name to highlight
   * @param {string} color - Color to use for highlighting
   * @returns {Promise} Promise that resolves when indicator is highlighted
   */
  highlightIndicator: function(indicator, color = '#F59E0B') {
    return new Promise((resolve, reject) => {
      if (!this.isInIframe) {
        reject(new Error('Not running in extension context'));
        return;
      }
      
      // Set up a one-time event handler for the response
      const responseHandler = (data) => {
        // Remove the handler after receiving response
        delete this.eventHandlers['indicator-highlighted'];
        resolve(data);
      };
      
      // Register handler for the response
      this.onMessage('indicator-highlighted', responseHandler);
      
      // Send the highlight request
      this.sendMessage('highlight-indicator', { indicator, color });
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (this.eventHandlers['indicator-highlighted'] === responseHandler) {
          delete this.eventHandlers['indicator-highlighted'];
          reject(new Error('Timeout waiting for indicator highlight'));
        }
      }, 5000);
    });
  },
  
  /**
   * Observe DOM element changes
   * @param {string} selector - CSS selector for element to observe
   * @param {function} callback - Function to call when element changes
   * @returns {string} Observer ID to reference this observer
   */
  observeElement: function(selector, callback) {
    if (!this.isInIframe) {
      console.warn('Cannot observe elements: not running in extension context');
      return null;
    }
    
    // Generate a unique ID for this observer
    const observerId = `observer-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Register handler for element changes
    this.onMessage('element-changed', (data) => {
      if (data.observerId === observerId) {
        callback(data);
      }
    });
    
    // Set up handler for observer creation confirmation
    this.onMessage('observer-created', (data) => {
      if (data.observerId === observerId) {
        console.log(`Observer created for ${selector}`);
      }
    });
    
    // Set up handler for observer errors
    this.onMessage('observer-error', (data) => {
      if (data.observerId === observerId) {
        console.error(`Observer error: ${data.error}`);
      }
    });
    
    // Request the observer
    this.sendMessage('observe-element', { selector, observerId });
    
    return observerId;
  }
};

// Next.js component usage example
function NextJsComponentExample() {
  // In your Next.js component
  
  useEffect(() => {
    // Initialize the extension client
    CandleExtension.init();
    
    // Listen for extension connection
    CandleExtension.onMessage('extension-connected', (data) => {
      console.log('Connected to Candle extension', data);
      
      // Now we can use the extension features
      updateChartData();
    });
    
    // Listen for chart updates
    CandleExtension.onMessage('chart-updated', (data) => {
      console.log('Chart updated', data);
      setChartData(data.chartData);
    });
    
    async function updateChartData() {
      try {
        // Request chart data
        const chartData = await CandleExtension.getChartData();
        console.log('Received chart data', chartData);
        setChartData(chartData);
        
        // Highlight an indicator
        await CandleExtension.highlightIndicator('RSI');
        console.log('RSI indicator highlighted');
        
        // Observe price changes
        CandleExtension.observeElement('.chart-container', (data) => {
          console.log('Chart container changed', data);
        });
      } catch (error) {
        console.error('Error interacting with extension', error);
      }
    }
    
    return () => {
      // Cleanup if needed
    };
  }, []);
  
  // Rest of your component...
}

// If you're using this in a non-module context, export to global
if (typeof window !== 'undefined') {
  window.CandleExtension = CandleExtension;
}

// If you're using ES modules
export default CandleExtension; 