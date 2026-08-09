import { supabase } from '../supabaseClient';

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

export const triggerAutoCleanup = async (shopId, currentOrders = []) => {
  try {
    // 1. Save current order details (metadata only, no raw file) to browser localStorage
    if (shopId && currentOrders.length > 0) {
      syncOrdersToLocalStorage(shopId, currentOrders);
    }

    // 2. Call serverless cleanup API endpoint on Vercel
    fetch('/api/cleanup').catch(() => {});

    // 3. Client-side storage file purge: delete files older than 5 mins directly from storage
    const fiveMinutesAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: oldOrders } = await supabase
      .from('orders')
      .select('id, file_path')
      .lt('created_at', fiveMinutesAgoIso);

    if (oldOrders && oldOrders.length > 0) {
      const pathsToRemove = oldOrders.map(o => {
        if (!o.file_path) return null;
        const parts = o.file_path.split('/print-jobs/');
        return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
      }).filter(Boolean);

      if (pathsToRemove.length > 0) {
        await supabase.storage.from('print-jobs').remove(pathsToRemove);
      }
    }
  } catch (err) {
    console.debug('Background cleanup check done.', err);
  }
};
