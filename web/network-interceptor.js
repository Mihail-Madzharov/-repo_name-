// Network interceptor - injected into the page
(function () {
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Intercept fetch
  window.fetch = function (...args) {
    const [resource, config] = args;
    const method = (config?.method || "GET").toUpperCase();
    const url = typeof resource === "string" ? resource : resource.url;
    const headers = config?.headers || {};
    const body = config?.body || null;

    const startTime = performance.now();

    // Record the request
    window.postMessage(
      {
        type: "NETWORK_REQUEST_CAPTURED",
        method,
        url,
        headers,
        body: body ? String(body).slice(0, 1000) : null,
      },
      "*"
    );

    // Call original fetch
    return originalFetch
      .apply(this, args)
      .then((response) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Clone response to read body
        const clonedResponse = response.clone();
        clonedResponse
          .text()
          .then((text) => {
            window.postMessage(
              {
                type: "NETWORK_RESPONSE_CAPTURED",
                url,
                status: response.status,
                headers: Object.fromEntries(response.headers),
                body: text.slice(0, 5000),
                responseTime: Math.round(responseTime),
              },
              "*"
            );
          })
          .catch(() => {
            window.postMessage(
              {
                type: "NETWORK_RESPONSE_CAPTURED",
                url,
                status: response.status,
                headers: Object.fromEntries(response.headers),
                body: "[Response body could not be read]",
                responseTime: Math.round(responseTime),
              },
              "*"
            );
          });

        return response;
      })
      .catch((error) => {
        window.postMessage(
          {
            type: "NETWORK_ERROR_CAPTURED",
            url,
            error: error.message,
          },
          "*"
        );
        throw error;
      });
  };

  // Intercept XMLHttpRequest
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    this._method = method;
    this._startTime = performance.now();
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    const startTime = this._startTime;
    const url = this._url;
    const method = this._method;
    const headers = {};

    // Try to capture request headers
    const headerKeys = [
      "Content-Type",
      "Authorization",
      "Accept",
      "User-Agent",
    ];
    headerKeys.forEach((key) => {
      try {
        const value = xhr.getRequestHeader(key);
        if (value) headers[key] = value;
      } catch {}
    });

    window.postMessage(
      {
        type: "NETWORK_REQUEST_CAPTURED",
        method,
        url,
        headers,
        body: body ? String(body).slice(0, 1000) : null,
      },
      "*"
    );

    // Wrap onreadystatechange
    const originalOnReadyStateChange = xhr.onreadystatechange;
    xhr.onreadystatechange = function () {
      if (this.readyState === 4) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        window.postMessage(
          {
            type: "NETWORK_RESPONSE_CAPTURED",
            url,
            status: this.status,
            headers: this.getAllResponseHeaders(),
            body: this.responseText.slice(0, 5000),
            responseTime: Math.round(responseTime),
          },
          "*"
        );
      }

      if (originalOnReadyStateChange) {
        return originalOnReadyStateChange.apply(this, arguments);
      }
    };

    return originalXHRSend.apply(this, [body]);
  };
})();
