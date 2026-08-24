import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Mandatory CRON_SECRET validation
  if (!cronSecret) {
    console.error('[cleanup] Server security configuration error: CRON_SECRET is not configured.');
    return res.status(500).json({ error: 'Server security configuration error: CRON_SECRET is not configured.' });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed authorization header.' });
  }

  const providedToken = authHeader.slice(7).trim();
  const providedBuf = Buffer.from(providedToken, 'utf8');
  const expectedBuf = Buffer.from(cronSecret.trim(), 'utf8');

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret.' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server database configuration error: missing Supabase credentials.' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const fiveMinutesAgoMs = Date.now() - 5 * 60 * 1000;
    
    // Calculate midnight timestamp for daily database order reset
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    let deletedFilesCount = 0;
    let deletedOrdersCount = 0;

    // 1. Storage Cleanup: Delete customer document files older than 5 minutes from 'print-jobs' bucket
    const { data: shopFolders, error: listErr } = await supabase.storage
      .from('print-jobs')
      .list('');

    if (shopFolders && shopFolders.length > 0) {
      for (const folder of shopFolders) {
        if (folder.name) {
          const { data: files } = await supabase.storage
            .from('print-jobs')
            .list(folder.name);

          if (files && files.length > 0) {
            const filesToRemove = [];
            for (const file of files) {
              const fileCreated = new Date(file.created_at || file.updated_at || file.last_accessed_at || Date.now()).getTime();
              if (fileCreated < fiveMinutesAgoMs) {
                filesToRemove.push(`${folder.name}/${file.name}`);
              }
            }

            if (filesToRemove.length > 0) {
              const { error: removeErr } = await supabase.storage
                .from('print-jobs')
                .remove(filesToRemove);

              if (!removeErr) {
                deletedFilesCount += filesToRemove.length;
              }
            }
          }
        }
      }
    }

    // 2. Daily Database Order Reset: Delete active order records created before 12 AM today
    const { data: oldOrders } = await supabase
      .from('orders')
      .select('id')
      .lt('created_at', startOfToday);

    if (oldOrders && oldOrders.length > 0) {
      const oldIds = oldOrders.map(o => o.id);
      const { error: deleteErr } = await supabase
        .from('orders')
        .delete()
        .in('id', oldIds);

      if (!deleteErr) {
        deletedOrdersCount = oldIds.length;
      }
    }

    return res.status(200).json({
      success: true,
      message: '5-minute file storage cleanup and daily 12 AM database order reset completed.',
      deletedFilesCount,
      deletedOrdersCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[cleanup] Execution error:', err);
    return res.status(500).json({ error: err.message || 'Server error during cleanup execution.' });
  }
}

