document.addEventListener("DOMContentLoaded", () => {
    const proxyServerInput = document.getElementById("proxyServer");
    const whitelistInput = document.getElementById("whitelist");
    const enabledInput = document.getElementById("enabled");
    const timezoneEnabledInput = document.getElementById("timezoneEnabled");
    const timezoneToggleContainer = document.getElementById("timezoneToggleContainer");
    const settingsBtn = document.getElementById("settingsBtn");
    const errorMsg = document.getElementById("error-msg");

    // Function to update timezone toggle state
    function updateTimezoneToggleState(proxyEnabled) {
        if (!proxyEnabled) {
            timezoneToggleContainer.classList.add("disabled");
            timezoneEnabledInput.disabled = true;
            if (timezoneEnabledInput.checked) {
                timezoneEnabledInput.checked = false;
                autoSave(); // Save the disabled state
            }
        } else {
            timezoneToggleContainer.classList.remove("disabled");
            timezoneEnabledInput.disabled = false;
        }
    }

    // Debounce utility
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Auto-save function
    const autoSave = () => {
        const proxyServerValue = proxyServerInput.value.trim();
        const whitelistRaw = whitelistInput.value;
        const whitelist = whitelistRaw.split("\n")
            .map(s => s.trim())
            .filter(s => s && !s.startsWith("#") && !s.startsWith("//")); // Filter empty lines and comments
        const enabled = enabledInput.checked;
        const timezoneEnabled = timezoneEnabledInput.checked && enabled; // Force false if proxy disabled

        // Parse host:port format
        let proxyHost = "";
        let proxyPort = "";

        if (proxyServerValue) {
            const parts = proxyServerValue.split(":");
            proxyHost = parts[0] || "";
            proxyPort = parts[1] || "";
        }

        // Validation
        // Strict check: Port must be digits only and within range
        const isPortPatternValid = /^\d+$/.test(proxyPort);
        const portNum = parseInt(proxyPort, 10);
        const isPortValid = isPortPatternValid && !isNaN(portNum) && portNum > 0 && portNum <= 65535;
        const isHostValid = proxyHost.length > 0;

        if (enabled) {
            if (!isHostValid) {
                proxyServerInput.style.borderColor = "red";
                if (errorMsg) {
                    errorMsg.textContent = "Error: Host cannot be empty.";
                    errorMsg.style.display = "block";
                }
                return;
            } else if (!isPortValid) {
                proxyServerInput.style.borderColor = "red";
                if (errorMsg) {
                    errorMsg.textContent = "Error: Port must be 1-65535.";
                    errorMsg.style.display = "block";
                }
                return;
            }
        }

        // Clear error if valid or disabled
        proxyServerInput.style.borderColor = "";
        if (errorMsg) {
            errorMsg.style.display = "none";
        }

        chrome.storage.local.set({ proxyHost, proxyPort, whitelist, whitelistRaw, enabled, timezoneEnabled }, () => {
            chrome.runtime.sendMessage({
                type: "updateProxy",
                proxyHost,
                proxyPort,
                whitelist,
                enabled,
                timezoneEnabled
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Error sending message
                }
            });
        });
    };

    const debouncedAutoSave = debounce(autoSave, 500);

    // Load saved values
    chrome.storage.local.get(["proxyHost", "proxyPort", "whitelist", "whitelistRaw", "enabled", "timezoneEnabled"], (data) => {
        // Combine host:port if both exist
        if (data.proxyHost && data.proxyPort) {
            proxyServerInput.value = `${data.proxyHost}:${data.proxyPort}`;
        } else if (data.proxyHost) {
            proxyServerInput.value = data.proxyHost;
        }

        if (data.whitelistRaw !== undefined) {
            whitelistInput.value = data.whitelistRaw;
        } else if (data.whitelist) {
            whitelistInput.value = data.whitelist.join("\n");
        }
        enabledInput.checked = !!data.enabled;
        timezoneEnabledInput.checked = !!data.timezoneEnabled && !!data.enabled;

        // Update timezone toggle state based on proxy state
        updateTimezoneToggleState(!!data.enabled);
    });

    // Add auto-save listeners to all inputs
    proxyServerInput.addEventListener("input", debouncedAutoSave);
    whitelistInput.addEventListener("input", debouncedAutoSave);

    // Auto-select text on focus for proxy server input
    proxyServerInput.addEventListener("focus", () => {
        proxyServerInput.select();
    });

    // Auto-select text on focus for whitelist input
    whitelistInput.addEventListener("focus", () => {
        whitelistInput.select();
    });

    // Proxy toggle listener
    enabledInput.addEventListener("change", () => {
        // If proxy is switched ON, automatically switch Timezone ON
        if (enabledInput.checked) {
            timezoneEnabledInput.checked = true;
        }
        updateTimezoneToggleState(enabledInput.checked);
        autoSave(); // Immediate save for toggle
    });

    timezoneEnabledInput.addEventListener("change", autoSave); // Immediate save for toggle

    // Settings button - open popup.html in new tab
    settingsBtn.addEventListener("click", () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("popup.html")
        });
    });
});