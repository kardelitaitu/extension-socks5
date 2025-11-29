// Constants
const CONSTANTS = {
    CONNECTION_TIMEOUT: 5000,
    RETRY_DELAY_INITIAL: 2000,
    PROXY_APPLY_DELAY: 500,
    FAST_RETRY_DELAY: 1000,
    MAX_FAST_RETRIES: 2,
    ALARM_RETRY: "retryConnectionCheck"
};

// State to track fast retries (in-memory is fine for short-term, alarms for long-term)
let fastRetryCount = 0;

const CHECK_URLS = [
    'https://www.google.com/generate_204',
    'https://1.1.1.1',
    'https://www.bing.com',
    'https://github.com',
    'https://www.cloudflare.com',
    'https://www.amazon.com',
    'https://www.wikipedia.org',
    'https://www.facebook.com',
    'https://www.microsoft.com'
];

async function checkConnection(retryDelay = CONSTANTS.RETRY_DELAY_INITIAL) {
    // Clear any existing retry alarm to prevent overlapping checks
    await chrome.alarms.clear(CONSTANTS.ALARM_RETRY);

    const checks = CHECK_URLS.map(url => {
        return new Promise(async (resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.CONNECTION_TIMEOUT);
            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-cache'
                    // Removed mode: 'no-cors' to allow status checking
                });
                clearTimeout(timeoutId);

                if (response.ok || response.status === 204) {
                    resolve(url);
                } else {
                    reject(new Error(`HTTP ${response.status}`));
                }
            } catch (e) {
                clearTimeout(timeoutId);
                reject(e);
            }
        });
    });

    try {
        const winner = await Promise.any(checks);
        console.log(`Connection verified via ${winner}`);

        chrome.action.setIcon({
            path: {
                "64": "/images/connected.64.png"
            }
        });
        chrome.action.setTitle({ title: "Proxy Connected" });

        // Trigger timezone detection if enabled
        chrome.storage.local.get("timezoneEnabled", (data) => {
            if (data.timezoneEnabled) {
                detectTimezone();
            }
        });

        // Reset fast retry count on success
        fastRetryCount = 0;
        return true;
    } catch (e) {
        console.warn(`All connection checks failed. Retrying in ${retryDelay / 1000}s...`);
        chrome.action.setIcon({
            path: {
                "64": "/images/disconnected.64.png"
            }
        });
        chrome.action.setTitle({ title: `Proxy Enabled - No Connection (Retrying in ${retryDelay / 1000}s)` });

        // Schedule alarm for retry IMMEDIATELY to prevent race conditions with SW termination
        chrome.alarms.create(CONSTANTS.ALARM_RETRY, {
            when: Date.now() + retryDelay
        });

        // Store the next delay in session storage
        chrome.storage.session.set({ nextRetryDelay: retryDelay * 2 });

        return false;
    }
}

// Alarm Listener for Retries
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CONSTANTS.ALARM_RETRY) {
        // Check if still enabled before retrying
        chrome.storage.local.get("enabled", (data) => {
            if (data.enabled) {
                chrome.storage.session.get("nextRetryDelay", (sessionData) => {
                    const delay = sessionData.nextRetryDelay || CONSTANTS.RETRY_DELAY_INITIAL;
                    checkConnection(delay);
                });
            }
        });
    }
});

function applyProxy(proxyHost, proxyPort, whitelist, enabled) {
    // Clear any pending retry alarm
    chrome.alarms.clear(CONSTANTS.ALARM_RETRY);
    fastRetryCount = 0;

    if (!enabled) {
        // Disable Proxy
        chrome.action.setIcon({
            path: {
                "64": "/images/disconnected.64.png"
            }
        });
        chrome.action.setTitle({ title: "Proxy Disabled" });

        chrome.proxy.settings.clear({ scope: "regular" }, () => {
            chrome.proxy.settings.set({
                value: { mode: "system" },
                scope: "regular"
            }, () => {
            });
        });
        return;
    }

    // Enable Proxy
    // 1. Set icon to disconnected initially (until verified)
    chrome.action.setIcon({
        path: {
            "64": "/images/disconnected.64.png"
        }
    });
    chrome.action.setTitle({ title: "Proxy Enabled - Checking Connection..." });

    const whitelistRules = (whitelist || []).map(domain => {
        if (domain.includes('*')) {
            // Handle explicit wildcards (e.g., 192.168.*, *.google.com)
            return `if (shExpMatch(host, "${domain}")) return "DIRECT";`;
        } else {
            // Handle standard domains (auto-include subdomains)
            return `if (dnsDomainIs(host, "${domain}") || shExpMatch(host, "*.${domain}")) return "DIRECT";`;
        }
    }).join("\n");

    const pacScript = `
    function FindProxyForURL(url, host) {
      ${whitelistRules}
      return "SOCKS5 ${proxyHost}:${proxyPort}";
    }
  `;

    chrome.proxy.settings.set({
        value: { mode: "pac_script", pacScript: { data: pacScript } },
        scope: "regular"
    }, () => {
        // Disable WebRTC non-proxied UDP to prevent leaks
        chrome.privacy.network.webRTCIPHandlingPolicy.set({
            value: 'disable_non_proxied_udp'
        });

        // 2. Check connection after proxy is applied
        // Fast retry logic: Check immediately, then retry quickly if failed
        const fastCheck = async () => {
            const success = await checkConnection(CONSTANTS.RETRY_DELAY_INITIAL);
            if (!success && fastRetryCount < CONSTANTS.MAX_FAST_RETRIES) {
                fastRetryCount++;
                console.warn(`Fast check ${fastRetryCount} failed, retrying in ${CONSTANTS.FAST_RETRY_DELAY}ms...`);
                // For fast retries (short duration), setTimeout is acceptable as user is likely interacting
                // But to be consistent with "no global state", we could use alarms too. 
                // However, fast retries are < 1s, so setTimeout is fine here.
                setTimeout(fastCheck, CONSTANTS.FAST_RETRY_DELAY);
            }
        };

        setTimeout(fastCheck, CONSTANTS.PROXY_APPLY_DELAY);
    });
}

// Load saved settings on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(["proxyHost", "proxyPort", "whitelist", "enabled"], (data) => {
        applyProxy(data.proxyHost || "", data.proxyPort || "", data.whitelist || [], !!data.enabled);
    });
});

// Also apply on extension install/update
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["proxyHost", "proxyPort", "whitelist", "enabled"], (data) => {
        applyProxy(data.proxyHost || "", data.proxyPort || "", data.whitelist || [], !!data.enabled);
    });
});

// Listen for changes from popup
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "updateProxy") {
        applyProxy(msg.proxyHost, msg.proxyPort, msg.whitelist, msg.enabled);
    } else if (msg.type === "detectTimezone") {
        detectTimezone();
    }
});

// Timezone Detection
async function detectTimezone() {
    // Clear existing timezone to trigger loading state in content scripts
    await chrome.storage.local.remove("detectedTimezoneId");

    const providers = [
        {
            url: 'https://ipwho.is/',
            parse: (data) => data.timezone.id,
            timeout: 3000
        },
        {
            url: 'https://worldtimeapi.org/api/ip',
            parse: (data) => data.timezone,
            timeout: 3000
        },
        {
            url: 'https://ipapi.co/json/',
            parse: (data) => data.timezone,
            timeout: 5000
        }
    ];

    const checks = providers.map(provider => {
        return new Promise(async (resolve, reject) => {
            const controller = new AbortController();
            const timeoutDuration = provider.timeout || 5000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

            try {
                const response = await fetch(provider.url, {
                    cache: 'no-cache',
                    signal: controller.signal,
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer'
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const timezone = provider.parse(data);

                if (timezone) {
                    resolve({ timezone, provider: provider.url });
                } else {
                    reject(new Error("No timezone found in response"));
                }
            } catch (e) {
                clearTimeout(timeoutId);
                reject(e);
            }
        });
    });

    try {
        const result = await Promise.any(checks);

        await chrome.storage.local.set({ detectedTimezoneId: result.timezone });

        // Notify all tabs to update timezone
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
                type: 'updateTimezone',
                timezone: result.timezone
            }).catch(() => { });
        }

        return result.timezone;
    } catch (e) {
        console.error("Failed to detect timezone from all providers.", e);
        return null;
    }
}