# Candle - AI-Powered Trading Assistant for TradingView

Candle is a Chrome extension that integrates an AI assistant directly into TradingView, enhancing your trading experience with intelligent insights, chart analysis, and an intuitive chat interface.

![Candle Extension Demo](demo-placeholder.png)

## Features

- **Seamless TradingView Integration**: Adds a sidebar chat interface that works with TradingView without disrupting your workflow
- **AI-Powered Chart Analysis**: Analyzes your charts and provides insights based on technical indicators
- **Indicator Highlighting**: Easily highlight and track important indicators on your chart
- **Easy Toggle Interface**: Show or hide the assistant with a single click
- **Responsive Design**: Adjustable sidebar width to fit your screen preferences
- **Local Storage**: Remembers your sidebar state between sessions

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore/) (link coming soon)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)
1. Download this repository and unzip it or clone it using Git
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The Candle extension should now be installed and visible in your Chrome toolbar

## Usage

1. Navigate to [TradingView](https://www.tradingview.com/)
2. Click the Candle extension icon in your Chrome toolbar or use the sidebar toggle that appears on TradingView
3. The AI assistant sidebar will appear on the right side of your TradingView chart
4. Interact with the AI assistant through the chat interface
5. Adjust the sidebar width by dragging the left edge

## Architecture

The Candle extension uses a simplified architecture:

- **Content Script**: Injects the sidebar into TradingView and manages communication with both TradingView DOM and the web app
- **Web App in iFrame**: Delivers the AI assistant UI and functionality
- **Bidirectional Communication**: Content script and web app communicate via messaging

## For Developers

### Extension Setup
The extension is built with vanilla JavaScript and uses:
- jQuery loaded from CDN for DOM manipulation
- PostMessage API for secure iframe communication

### Web App Integration
If you're working on the web app side, use the provided `extension-client.js` module to communicate with the extension. It provides a simple API for bidirectional communication:

```javascript
// Initialize the client
CandleExtension.init();

// Listen for messages from the extension
CandleExtension.onMessage('chart-updated', data => {
  console.log('Chart data:', data);
});

// Send messages to the extension
CandleExtension.sendMessage('analyze-chart', { timeframe: '1h' });

// Get chart data
const chartData = await CandleExtension.getChartData();
```

### Project Structure
```
candle/
├── manifest.json           # Extension manifest
├── content.js              # TradingView integration & iframe communication
├── extension-client.js     # Web app client library for extension communication
├── icon-16.png             # Extension icons
├── icon-48.png
├── icon-128.png
└── README.md               # This file
```

## Development Workflow

1. Make changes to the extension files
2. Reload the extension in `chrome://extensions/` by clicking the refresh icon
3. Refresh TradingView to see your changes

## Security Considerations

- The extension uses content security policy restrictions to prevent XSS attacks
- Communication between the extension and web app is secured through origin validation
- The extension requests minimal permissions to respect user privacy

## Troubleshooting

**Extension not appearing on TradingView:**
- Ensure the extension is enabled in Chrome
- Try refreshing the TradingView page
- Check the console for any error messages

**Sidebar not loading correctly:**
- Verify your internet connection to ensure the web app loads
- Check for console errors that might indicate communication issues

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

Project Link: [https://github.com/yourusername/candle](https://github.com/yourusername/candle)

---

Made with ❤️ for traders 