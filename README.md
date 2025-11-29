# SOCKS5 Proxy & Timezone Spoofing Extension

A powerful, privacy-focused Chrome extension that integrates a SOCKS5 proxy with intelligent timezone spoofing. It ensures your browser's timezone always matches your proxy location, preventing common identity leaks.

## 🚀 Key Features

*   **SOCKS5 Proxy Support**: Easily configure your SOCKS5 proxy (Host:Port).
*   **Smart Timezone Spoofing**: Automatically detects the timezone of your proxy IP and updates your browser's timezone to match.
    *   Prevents "Timezone Mismatch" leaks on sites like Whoer.net or Pixelscan.
    *   Uses `Intl.DateTimeFormat` and `Date` overrides for native-like behavior.
*   **Advanced Whitelisting**:
    *   Bypass the proxy for specific domains (e.g., banking, local network).
    *   **Wildcard Support**: Use `*.google.com`, `*google*`, or `192.168.*`.
    *   **Comments**: Add notes to your whitelist using `#` or `//`.
*   **WebRTC Protection**: Automatically disables non-proxied UDP traffic to prevent IP leaks.
*   **Connection Health Check**: Verifies your proxy connection status and timezone spoofing in real-time.
*   **Stealth Mode**: Designed to be undetectable by common anti-bot scripts.

## 📦 Installation

1.  **Download/Clone** this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (top right toggle).
4.  Click **Load unpacked**.
5.  Select the folder containing this extension.

### Alternative: Auto-Load via Shortcut, no need **Developer mode** (Advanced)
This method allows you to load the extension automatically every time you open Chrome, without needing to re-enable Developer Mode or load it manually.

1.  **Locate your Chrome Shortcut** (on Desktop or Taskbar).
2.  **Right-click** the shortcut and select **Properties**.
3.  Find the **Target** field. It will look something like this:
    `"C:\Program Files\Google\Chrome\Application\chrome.exe"`
4.  Add a space at the end, then add the following flag:
    `--load-extension="C:\Path\To\Your\Extension\Folder"`
    *   *Example*: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --load-extension="C:\chrome-extension\extension-socks5"`
5.  Click **Apply** and **OK**.
6.  **Important**: Close **ALL** open Chrome windows (check Task Manager if needed) before using the new shortcut.

## 🛠️ Usage

### 1. Setting up the Proxy
1.  Click the extension icon.
2.  Enter your SOCKS5 proxy in the format: `IP:PORT` (e.g., `1.2.3.4:1080`).
3.  Toggle **Proxy** to ON.

### 2. Timezone Spoofing
1.  Toggle **Spoof Timezone** to ON.
2.  The extension will automatically detect the proxy's location and adjust your browser time.
3.  **Note**: If detection fails, it will retry automatically.

### 3. Whitelisting
Add domains you want to access *directly* (without proxy) in the text area.
*   **One entry per line.**
*   **Wildcards supported:**
    *   `localhost`
    *   `192.168.*` (Local Network)
    *   `*.google.com` (Subdomains)
    *   `*netflix*` (Pattern match)
*   **Comments supported:**
    *   `# This is a comment`
    *   `// This is also a comment`

## 🔒 Privacy & Security

*   **No Data Collection**: This extension operates entirely locally. No data is sent to external servers other than the necessary requests to check your proxy connection and detect timezone (via `ipwho.is` or `worldtimeapi.org`).
*   **Open Source**: You can inspect the source code to verify its safety.

## 📝 Changelog

See [patchnotes.md](patchnotes.md) for the full version history.

## ⚠️ Disclaimer

This tool is for educational and privacy protection purposes. The author is not responsible for any misuse.

## 📄 License

This project is licensed for **Personal Use Only**.
**Commercial use is strictly prohibited** without prior permission from the author.
Please contact the author for commercial inquiries.
