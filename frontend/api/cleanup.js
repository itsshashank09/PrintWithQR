import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Allow manual, browser, or Vercel cron invocation
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ message: 'Supabase credentials not configured.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fiveMinutesAgoMs = Date.now() - 5 * 60 * 1000;
    
    // Calculate midnight timestamp for daily database order reset
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    let deletedFilesCount = 0;
    let deletedOrdersCount = 0;

    // 1. Storage Cleanup: Delete customer document files older than 5 minutes from 'print-jobs' bucket
    // (Ensures raw customer files do not stay in storage or get saved to browser)
    const { data: shopFolders } = await supabase.storage
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
    // (Order details are backed up into owner's browser localStorage prior to midnight reset)
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
    console.error('Cleanup execution error:', err);
    return res.status(500).json({ error: err.message });
  }
}
