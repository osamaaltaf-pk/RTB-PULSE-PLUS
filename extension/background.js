// background.js for Chrome Extension Side Panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));

// High-priority batch fetching to bypass message passing overhead and side panel throttling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_BATCH') {
    handleBatchFetch(msg.routes)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keeps message channel open for async response
  }
});

async function handleBatchFetch(routes) {
  const results = await Promise.all(
    routes.map(async ({ id, url }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const json = await res.json();
        return { id, success: true, data: json };
      } catch (e) {
        return { id, success: false, error: e.message };
      }
    })
  );
  return { results };
}
