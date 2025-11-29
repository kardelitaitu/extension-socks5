document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get('target');

    // Security: Validate protocol to prevent open redirects to non-http schemes
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        statusEl.textContent = "Error: Invalid or missing target URL.";
        return;
    }

    function checkTimezone() {
        chrome.storage.local.get(['detectedTimezoneId', 'timezoneEnabled'], (data) => {
            // If timezone spoofing was disabled, just redirect back
            if (!data.timezoneEnabled) {
                window.location.href = targetUrl;
                return;
            }

            // If timezone is found, redirect back with timezone in window.name
            if (data.detectedTimezoneId) {
                statusEl.textContent = `Timezone detected: ${data.detectedTimezoneId}`;
                setTimeout(() => {
                    // Pass timezone via window.name (persists across redirect, invisible in URL)
                    // Format: Z_TZ_MARKER:TimezoneID::OriginalWindowName
                    const oldName = window.name || "";
                    window.name = `Z_TZ_MARKER:${data.detectedTimezoneId}::${oldName}`;

                    window.location.href = targetUrl;
                }, 500); // Small delay for visual feedback
                return;
            }

            statusEl.textContent = "Detecting timezone from proxy...";
        });
    }

    // Check immediately
    checkTimezone();

    // Listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.detectedTimezoneId || changes.timezoneEnabled) {
                checkTimezone();
            }
        }
    });

    // Timeout fallback (10s)
    setTimeout(() => {
        statusEl.textContent = "Error: Failed to detect timezone from proxy.";
        statusEl.style.color = "#ff4444";

        // Create Try Again button
        const retryBtn = document.createElement("button");
        retryBtn.textContent = "Try Again";
        retryBtn.style.marginTop = "10px";
        retryBtn.style.padding = "8px 16px";
        retryBtn.style.cursor = "pointer";
        retryBtn.onclick = () => location.reload();

        statusEl.appendChild(document.createElement("br"));
        statusEl.appendChild(retryBtn);
    }, 10000);

    // Override button listener
    const overrideBtn = document.getElementById('overrideBtn');
    if (overrideBtn) {
        overrideBtn.addEventListener('click', () => {
            if (targetUrl) {
                try {
                    const url = new URL(targetUrl);
                    url.searchParams.set('z_override', 'true');
                    window.location.href = url.toString();
                } catch (e) {
                    // Fallback if URL parsing fails
                    window.location.href = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'z_override=true';
                }
            }
        });
    }
});
