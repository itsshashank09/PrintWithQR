/**
 * Client-Side Order History Synchronizer
 * Saves safe order metadata (excluding raw file links) into browser localStorage
 * for offline shop owner dashboard viewing.
 */
export const syncOrdersToLocalStorage = (shopId, newOrders) => {
  if (!shopId || !Array.isArray(newOrders)) return;
  try {
    const key = `orders_history_${shopId}`;
    const existingStr = localStorage.getItem(key);
    const existing = existingStr ? JSON.parse(existingStr) : [];

    const historyMap = new Map();
    // Load existing history
    existing.forEach(item => {
      if (item && item.id) {
        historyMap.set(item.id, item);
      }
    });

    // Merge new orders (strip out file_path URL for privacy)
    newOrders.forEach(o => {
      if (o && o.id) {
        const orderCopy = { ...o };
        delete orderCopy.file_path; // Remove file link so raw document is never saved in browser
        historyMap.set(o.id, orderCopy);
      }
    });

    const updatedHistory = Array.from(historyMap.values());
    localStorage.setItem(key, JSON.stringify(updatedHistory));
  } catch (err) {
    console.error('Error saving order history to browser:', err);
  }
};

export const triggerAutoCleanup = (shopId, currentOrders = []) => {
  // Safe client-side metadata backup only; maintenance cleanup is handled exclusively by server cron
  if (shopId && Array.isArray(currentOrders) && currentOrders.length > 0) {
    syncOrdersToLocalStorage(shopId, currentOrders);
  }
};

