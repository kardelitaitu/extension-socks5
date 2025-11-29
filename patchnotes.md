v0.1
- Initial Release: Project initialization and basic extension structure

v0.2
- Core Proxy: Implemented SOCKS5 proxy support with PAC script generation
- Privacy: Added smart Timezone Spoofing to match proxy location
- Configuration: Added Domain Whitelist support for direct connections
- UI: Created Popup interface for easy proxy management
- UX: Implemented Loading Screen for seamless transitions
- Detection: Added automatic detection for Proxy connection and Timezone mismatches

v0.3
- Stealth Mode: Removed console logs and added toString() protection for native-like spoofing
- Security: Removed insecure HTTP providers and added strict input validation
- Robustness: Added fast-retry logic and more reliable connection check URLs (Amazon, Wikipedia, etc.)
- UX: Improved popup error messages and added "Try Again" button to loading screen
- Code Quality: Refactored magic numbers into constants and removed dead code

v0.4
- Ease of Use: Added "Auto-Select on Focus" for Proxy Server and Whitelist textboxes to speed up editing
- Performance: Optimized storage usage with debounce logic to prevent spamming writes while typing

v0.5
- Reliability: Replaced fragile setTimeout retries with chrome.alarms to ensure connection checks continue even if the extension sleeps
- Accuracy: Improved connection check logic to verify actual HTTP status (200 OK) instead of just opaque responses
- Fixes: Resolved "Service Worker registration failed" and "Cannot read properties of undefined" errors

v0.6
- Wildcard Support: Added full wildcard support for whitelist (e.g.,  `*google*`,`*.google.com`, `192.168.*`)
- Comments: Added support for comments in whitelist using `#` or `//`
- UI Improvements: Changed Proxy Server input to a standard text box and fixed CSS layout issues
- Fixes: Resolved critical timezone injection bugs and improved content script reliability
