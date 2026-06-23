// Inject fetch and XMLHttpRequest interceptor into the page
const script = document.createElement("script");
script.src = chrome.runtime.getURL("network-interceptor.js");
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected script
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === "NETWORK_REQUEST_CAPTURED") {
    // Forward to the background script
    chrome.runtime.sendMessage(event.data).catch(() => {
      // Extension context may not be available
    });
  }
});
