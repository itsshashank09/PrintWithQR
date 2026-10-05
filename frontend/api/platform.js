import crypto from 'node:crypto';
import { signedFileBatch } from './_lib/file-access.js';
import { customerQueueStatus, documentSeconds, waitingExpired, QUEUE_WAIT_MS } from './_lib/queue-clock.js';
import { db, headers, body, user, isAdmin, authorizeShop, hash, secret, fail, BUCKET, MAX_BYTES, fileKeys, rateLimit } from './_lib/security.js';

export default async function handler(req, res) {
  try {
    headers(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    const action = req.query?.action;
    const input = req.method === 'GET' ? req.query : body(req);
    const methods = { public_shop: 'GET', upload_intent: 'POST', customer_status: 'GET', me: 'GET', file_url: 'POST', file_urls: 'POST', status: 'POST', admin: 'GET', admin_update: 'POST' };
    if (!methods[action]) throw fail(404, 'Unknown operation.');
    if (req.method !== methods[action]) throw fail(405, 'Method not allowed.');
    const client = db();
    if (action === 'public_shop') {
      const { data, error } = await client.from('shops').select('id,name,address,bw_rate,color_rate,color_enabled,is_paid,subscription_status,subscription_expires_at,free_prints_allowed,free_prints_used').eq('id', String(input.shopId || '')).maybeSingle();
      if (error) throw fail(503, 'Unable to load this business.');
      if (!data) throw fail(404, 'Business not found.');
      return res.json({ shop: data });
    }
    if (action === 'upload_intent') {
      await rateLimit(client, req, 'upload', 40);
      const { shopId, name, mime, size } = input;
      if (typeof name !== 'string' || !name.trim() || name.length > 150 || !['application/pdf', 'image/png', 'image/jpeg', 'application/zip'].includes(mime) || (mime === 'application/zip' && !/\.zip$/i.test(name.trim())) || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) throw fail(400, 'Use a PDF, PNG, JPEG or ZIP within the file size limit.');
      const { data: shop, error } = await client.from('shops').select('id,is_paid,subscription_status,subscription_expires_at,free_prints_allowed,free_prints_used').eq('id', String(shopId || '')).maybeSingle();
      if (error) throw fail(503, 'Unable to verify this business.');
      const paid = shop?.is_paid === 1 && shop.subscription_status === 'active' && (!shop.subscription_expires_at || new Date(shop.subscription_expires_at) > new Date());
      const trial = shop?.subscription_status === 'free' && Number(shop.free_prints_used || 0) < Number(shop.free_prints_allowed ?? 10);
      if (!shop || (!paid && !trial)) throw fail(403, 'Business is unavailable for new print orders.');
      const id = crypto.randomUUID(), token = secret();
      const key = `${shop.id}/${id}.${mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'application/zip' ? 'zip' : 'jpg'}`;
      const { error: insertError } = await client.from('print_upload_intents').insert({ id, shop_id: shop.id, object_key: key, token_hash: hash(token), file_name: name.trim(), mime_type: mime, byte_size: size });
      if (insertError) throw fail(503, 'Unable to prepare upload.');
      const { data, error: signError } = await client.storage.from(BUCKET).createSignedUploadUrl(key, { upsert: false });
      if (signError) throw fail(503, 'Unable to authorize upload.');
      return res.json({ intentId: id, intentToken: token, path: key, uploadToken: data.token, uploadUrl: data.signedUrl });
    }
    if (action === 'customer_status') {
      const token = req.headers['x-order-token'];
      if (typeof token !== 'string' || token.length < 30 || token.length > 100) throw fail(404, 'Order access is unavailable. Use the device that placed this order.');
      const { data, error } = await client.from('orders').select('id,status,file_name,pages_to_print,print_type,paper_size,duplex,total_amount,print_options,created_at,shop_id,customer_access_hash,shops(name)').eq('id', String(input.orderId || '')).eq('customer_access_hash', hash(token)).maybeSingle();
      if (error || !data) throw fail(404, 'Order access is unavailable.');
      const { customer_access_hash, shop_id, shops, ...order } = data;
      // One unguessable capability belongs to a single checkout batch. An order ID
      // alone never authorizes this query, and documents/paths are never returned.
      const { data: batch, error: batchError } = await client.from('orders').select('id,status,file_name,pages_to_print,print_type,paper_size,duplex,total_amount,print_options,created_at').eq('shop_id', shop_id).eq('customer_access_hash', customer_access_hash).order('created_at', { ascending: true }).limit(10);
      if (batchError) throw fail(503, 'Unable to refresh order status. Please retry.');
      return res.json({ order: { ...customerQueueStatus(order), shop_name: shops?.name || 'Print counter' }, orders: (batch || [order]).map(row => customerQueueStatus(row)), shop: { id: shop_id, name: shops?.name || 'Print counter' } });
    }
    const caller = await user(client, req);
    if (action === 'file_urls') return res.json(await signedFileBatch(client, caller.id, input.files, { startPrinting: input.startPrinting ?? false }));
    if (action === 'me') {
      const { data: memberships, error } = await client.from('shop_members').select('shop_id,role,shops(*)').eq('user_id', caller.id).eq('active', true);
      if (error) throw fail(503, 'Unable to load account.');
      return res.json({ userId: caller.id, isAdmin: await isAdmin(client, caller.id), shops: (memberships || []).map(m => ({ ...m.shops, member_role: m.role })) });
    }
    if (action === 'admin' || action === 'admin_update') {
      if (!await isAdmin(client, caller.id)) throw fail(403, 'Administrator access required.');
      if (action === 'admin') {
        const { data, error } = await client.from('shops').select('id,name,phone,address,printer_model,bw_rate,color_rate,color_enabled,is_paid,is_admin,subscription_status,subscription_expires_at,subscription_plan,free_prints_allowed,free_prints_used,created_at').order('created_at', { ascending: false });
        if (error) throw fail(503, 'Unable to load businesses.');
        return res.json({ shops: data });
      }
      const fields = input.fields || {};
      if (!['active','inactive','free'].includes(fields.subscription_status) || ![0,1].includes(fields.is_paid) || (fields.subscription_expires_at && !Number.isFinite(Date.parse(fields.subscription_expires_at)))) throw fail(400, 'Invalid subscription settings.');
      const { error } = await client.from('shops').update({ subscription_status: fields.subscription_status, is_paid: fields.is_paid, subscription_expires_at: fields.subscription_expires_at || null }).eq('id', String(input.shopId));
      if (error) throw fail(503, 'Unable to update subscription.');
      return res.json({ success: true });
    }
    const { data: order, error } = await client.from('orders').select('*').eq('id', String(input.orderId || '')).maybeSingle();
    if (error || !order) throw fail(404, 'Order not found.');
    await authorizeShop(client, caller.id, order.shop_id);
    if (action === 'file_url') {
      const expiry = documentSeconds(order);
      if (!expiry) throw fail(410, 'This document has expired.');
      const keys = fileKeys(order);
      const index = Number(input.index || 0);
      if (!Number.isInteger(index) || index < 0 || index >= keys.length) throw fail(400, 'Invalid document index.');
      const { data, error: signError } = await client.storage.from(BUCKET).createSignedUrl(keys[index], expiry);
      if (signError) throw fail(410, 'Document is unavailable or has expired.');
      return res.json({ url: data.signedUrl, expiresIn: expiry });
    }
    // Download-only ZIPs can finish without entering the printer workflow.
    if (waitingExpired(order)) throw fail(410, 'The ten-minute queue timer has expired. Submit the file again if needed.');
    const archive = /\.zip$/i.test(String(order.file_path || ''));
    const transitions = { Pending: archive ? ['Completed','Cancelled'] : ['Printing','Cancelled'], Printing: ['Completed','Cancelled'], Completed: [], Cancelled: [] };
    if (input.status === order.status) return res.json({ success: true });
    if (!transitions[order.status]?.includes(input.status)) throw fail(409, 'This order status transition is not allowed.');
    const update = { status: input.status, ...(['Completed','Cancelled'].includes(input.status) ? { completed_at: new Date().toISOString() } : {}) };
    let change = client.from('orders').update(update).eq('id', order.id).eq('status', order.status);
    if (order.status === 'Pending') change = change.gt('created_at', new Date(Date.now() - QUEUE_WAIT_MS).toISOString());
    const { data: changed, error: updateError } = await change.select('id');
    if (updateError || !changed?.length) throw fail(409, 'Order changed. Refresh and try again.');
    return res.json({ success: true });
  } catch (error) {
    if (!error.status) console.error('[platform] Operation failed:', error.code || error.name);
    return res.status(error.status || 503).json({ error: error.status ? error.message : 'Service is temporarily unavailable.' });
  }
}
