import { PDFDocument } from 'pdf-lib';
import { db, headers, body, hash, fail, BUCKET, MAX_BYTES, pageSelection, rateLimit } from './security.js';
import { validateZip } from './archives.js';

export async function createSecureOrders(req, res) {
  try {
    headers(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') throw fail(405, 'Method not allowed.');
    const input = body(req);
    const { shopId, orders, customerToken } = input;
    if (typeof shopId !== 'string' || !Array.isArray(orders) || orders.length < 1 || orders.length > 10) throw fail(400, 'Select 1–10 documents.');
    if (new Set(orders.map(item => item?.intentId)).size !== orders.length) throw fail(400, 'Each document may appear only once.');
    if (typeof customerToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(customerToken)) throw fail(401, 'A secure order session is required. Please refresh.');
    const client = db();
    await rateLimit(client, req, 'order', 25);
    const items = [];
    for (const [batchIndex, item] of orders.entries()) {
      if (!/^[0-9a-f-]{36}$/i.test(item.intentId || '') || typeof item.intentToken !== 'string' || item.intentToken.length !== 43) throw fail(403, 'Invalid upload authorization.');
      const { data: intent, error } = await client.from('print_upload_intents').select('*').eq('id', item.intentId).eq('shop_id', shopId).eq('token_hash', hash(item.intentToken)).maybeSingle();
      if (error) throw fail(503, 'Unable to verify upload.');
      if (!intent) throw fail(403, 'Upload does not belong to this order session.');
      // A retry reuses the validated item; the RPC checks the original customer token.
      if (intent.order_id) {
        items.push({ intent_id: intent.id, token_hash: intent.token_hash, pages: 1, print_type: 'bw', paper_size: 'A4', duplex: 0, print_options: {} });
        continue;
      }
      if (Date.parse(intent.expires_at) < Date.now()) throw fail(410, 'Upload authorization expired. Upload the file again.');
      const { data: blob, error: downloadError } = await client.storage.from(BUCKET).download(intent.object_key);
      if (downloadError || !blob) throw fail(400, 'Document upload is incomplete.');
      if (blob.size !== Number(intent.byte_size) || blob.size > MAX_BYTES) throw fail(400, 'Document size does not match the authorized upload.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (intent.mime_type === 'application/zip') {
        const archive = await validateZip(bytes);
        // ZIPs have no print options; neutral legacy fields preserve the order schema.
        items.push({ intent_id: intent.id, token_hash: intent.token_hash, pages: 1, print_type: 'bw', paper_size: 'A4', duplex: 0, print_options: { fileKind: 'zip', pricePending: true, ...archive, batchIndex } });
        continue;
      }
      let total;
      if (intent.mime_type === 'application/pdf') {
        if (Buffer.from(bytes.slice(0, 5)).toString() !== '%PDF-') throw fail(400, 'This document is not a valid PDF.');
        try { total = (await PDFDocument.load(bytes)).getPageCount(); }
        catch { throw fail(400, 'PDF is damaged or password protected. Upload an unlocked PDF.'); }
      } else {
        const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if ((intent.mime_type === 'image/png' && !png) || (intent.mime_type === 'image/jpeg' && !jpeg)) throw fail(400, 'Image format does not match the upload.');
        total = 1;
      }
      const pages = pageSelection(total, item.rangeType || 'all', item.rangeCustom || '');
      if (!pages) throw fail(400, 'Select at least one page.');
      if (!['bw','color'].includes(item.print_type) || !['A4','Letter','16:9'].includes(item.paper_size)) throw fail(400, 'Invalid print settings.');
      items.push({ intent_id: intent.id, token_hash: intent.token_hash, pages, print_type: item.print_type, paper_size: item.paper_size, duplex: item.duplex ? 1 : 0, print_options: { rangeType: item.rangeType || 'all', rangeCustom: item.rangeCustom || '', documentPages: total, batchIndex } });
    }
    const { data, error } = await client.rpc('commit_print_orders', { p_shop_id: shopId, p_items: items, p_access_hash: hash(customerToken) });
    if (error) {
      const safe = ['Upload authorization expired.','Upload already used.','Shop unavailable.','Not enough trial pages.','Color printing unavailable.','Invalid rate.'];
      throw fail(409, safe.includes(error.message) ? error.message : 'Unable to place the order. Refresh and try again.');
    }
    return res.json({ success: true, orderIds: data });
  } catch (error) {
    if (!error.status) console.error('[orders] Operation failed:', error.code || error.name);
    return res.status(error.status || 503).json({ error: error.status ? error.message : 'Service is temporarily unavailable.' });
  }
}
