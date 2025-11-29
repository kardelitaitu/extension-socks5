# Future Updates & Roadmap

## 1. Robust Timezone Spoofing

### Current State (The "Before")
Currently, the extension uses Prototype Overriding (Monkey Patching) in `content-main.js`.

-   **Mechanism:** We overwrite `Date.prototype.getTimezoneOffset`, `Date.prototype.toString`, and `Intl.DateTimeFormat`.
-   **Weakness:** This is "Fragile".
    -   **Detectability:** Sophisticated scripts can detect that the functions have been tampered with (e.g., checking `Date.prototype.toString.toString()` to see if it returns `[native code]`). While we try to hide this with `protectFunction`, it's a cat-and-mouse game.
    -   **Iframes:** If a website creates an `<iframe>`, that iframe has its own clean `window` and `Date` objects. Our current script might not inject into the iframe fast enough or at all (depending on `all_frames` setting and timing), allowing the site to leak the real timezone.
    -   **Inconsistency:** Sometimes `Date` works but `Intl` fails, or vice versa, leading to obvious discrepancies.

### Future Strategy (The "After")
We will move to a **Native Emulation** strategy or a **Hardened Injection** strategy.

#### Strategy A: Native Emulation (Chrome Debugger API) - *Recommended for Stealth*
Instead of hacking JavaScript objects, we use the browser's built-in developer tools capabilities programmatically.
-   **Mechanism:** Use `chrome.debugger` API to attach to the tab and send the `Emulation.setTimezoneOverride` command.
-   **Pros:**
    -   **Undetectable:** The browser itself changes the timezone at the engine level. No JavaScript overrides are needed. `new Date()` returns the spoofed time natively.
    -   **Perfect Consistency:** Applies to all frames, workers, and API calls automatically.
-   **Cons:**
    -   **UX Warning:** Chrome displays a warning banner: *"Extension is debugging this browser"* which might be annoying for daily use.

#### Strategy B: Hardened Injection (Advanced Monkey Patching)
If we must avoid the Debugger API, we will harden the current approach.
-   **Mechanism:**
    -   **Proxy Traps:** Instead of simple overwrites, use ES6 `Proxy` objects to wrap the `Date` constructor. This is harder to detect.
    -   **Iframe Injection:** Use `MutationObserver` to detect when an iframe is added to the DOM and immediately inject the spoofing script into it before it loads content.
    -   **Object Freezing:** Freeze the overridden prototypes so other scripts cannot revert them.

## 2. Secure Connection Check

### Current State (The "Before")
The extension uses a "blind" `no-cors` check to `https://www.google.com/generate_204` etc.
-   **Weakness:** `no-cors` returns an opaque response. If the proxy fails and the browser falls back to direct connection, the fetch might still succeed, giving a false sense of security.

### Future Strategy (The "After")
-   **Real IP Verification:** Fetch a "what is my IP" service (e.g., `ipwho.is`) and verify the returned IP matches the proxy IP.
-   **Status Validation:** Ensure we can read the response status (requires CORS or a proxy-friendly endpoint).

## 3. Service Worker Reliability

### Current State (The "Before")
The extension relies on global variables (e.g., `connectionRetryTimeout`) in `background.js`.
-   **Weakness:** In Manifest V3, Service Workers are ephemeral. When they go to sleep, global variables are lost, killing any pending retry logic.

### Future Strategy (The "After")
-   **Chrome Alarms:** Use `chrome.alarms` for all scheduling and retries. Alarms persist across Service Worker restarts.
-   **Session Storage:** Use `chrome.storage.session` to persist transient state (like "currently connecting") across SW lifecycles.