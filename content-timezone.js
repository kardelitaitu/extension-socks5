// Content script (ISOLATED world)
(function () {
  'use strict';

  // Helper to send timezone to MAIN world
  function sendToMainWorld(timezone) {
    window.postMessage({
      type: 'TIMEZONE_UPDATE',
      timezone: timezone
    }, '*');
  }

  // 1. Immediately hide everything to prevent visual leaks
  // This runs at document_start, so document.documentElement (<html>) usually exists
  const style = document.createElement('style');
  style.textContent = 'html { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);

  // Get initial timezone setting
  chrome.storage.local.get(['timezoneEnabled', 'detectedTimezoneId', 'whitelist'], (data) => {

    // 2. Check Override Parameter
    const url = new URL(window.location.href);
    if (url.searchParams.get('z_override') === 'true') {
      // Clean URL
      url.searchParams.delete('z_override');

      // Construct clean URL without trailing ? if params are empty
      const cleanUrl = url.search ? url.toString() : `${url.origin}${url.pathname}`;

      window.history.replaceState({}, '', cleanUrl);

      // Show page and exit (disable spoofing for this session)
      if (style.parentNode) style.parentNode.removeChild(style);
      return;
    }

    // 3. Check Whitelist
    const isWhitelisted = (data.whitelist || []).some(pattern => {
      // Handle explicit wildcards (e.g., 192.168.*, *google*)
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(window.location.hostname);
      }
      // Handle standard domains (auto-include subdomains)
      return window.location.hostname === pattern || window.location.hostname.endsWith('.' + pattern);
    });

    if (isWhitelisted) {
      // Show page and exit
      if (style.parentNode) style.parentNode.removeChild(style);
      return;
    }

    // Check if we need to show loading screen
    if (data.timezoneEnabled && !data.detectedTimezoneId) {
      // Avoid redirecting if already on loading page or not a http/https page
      if (window.location.protocol.startsWith('http') &&
        !window.location.href.includes('loading.html')) {

        // Stop further execution immediately to prevent scripts from running
        window.stop();

        const loadingUrl = chrome.runtime.getURL('loading.html') +
          '?target=' + encodeURIComponent(window.location.href);
        window.location.href = loadingUrl;
        return;
      }
    }

    // If we are here, it's safe to show the page
    if (style.parentNode) style.parentNode.removeChild(style);

    if (data.timezoneEnabled && data.detectedTimezoneId) {
      sendToMainWorld(data.detectedTimezoneId);
    }
  });

  // Listen for timezone updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateTimezone') {
      sendToMainWorld(message.timezone);
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.timezoneEnabled || changes.detectedTimezoneId) {
        chrome.storage.local.get(['timezoneEnabled', 'detectedTimezoneId'], (data) => {
          const timezone = data.timezoneEnabled ? data.detectedTimezoneId : null;
          sendToMainWorld(timezone);
        });
      }
    }
  });
})();
