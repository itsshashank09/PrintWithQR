import crypto from 'node:crypto';
import { db, BUCKET, fail, body } from './_lib/security.js';
import { expireWaitingOrder, deleteOrderFiles } from './_lib/queue-cleanup.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  try {
    if (!['GET','POST'].includes(req.method)) throw fail(405,'Method not allowed.');
    const expected=process.env.PRINT_CLEANUP_SECRET || process.env.CRON_SECRET;
    if (!expected) throw fail(503,'Cleanup configuration unavailable.');
    const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
    const a=Buffer.from(supplied),b=Buffer.from(expected);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) throw fail(401,'Unauthorized.');
    const client=db();
    if(req.method==='POST'&&body(req).configure===true) {
      const {error}=await client.rpc('configure_print_cleanup',{p_secret:expected});
      if(error) throw fail(503,'Cleanup scheduler configuration failed.');
      return res.json({success:true,scheduled:'every minute',retentionMinutes:10});
    }
    const now=new Date(),cutoff=new Date(now.getTime()-600000).toISOString();
    let deletedFilesCount=0,failures=0,expiredOrdersCount=0;
    const {data:waiting,error:waitingError}=await client.from('orders').select('id,shop_id,file_path,status,created_at,print_options').eq('status','Pending').lte('created_at',cutoff).is('file_deleted_at',null).order('created_at').limit(50);
    if(waitingError) throw fail(503,'Unable to load expired queue entries.');
    for(const order of waiting||[]) {
      try { if(await expireWaitingOrder(client,order,now.getTime())) expiredOrdersCount++; }
      catch { failures++; }
    }
    // Expired waiting files are eligible immediately, including failed deletion
    // retries. Manual Done/Cancel still gets the existing ten-minute retention.
    const {data:orders,error}=await client.from('orders').select('id,shop_id,file_path').in('status',['Completed','Cancelled']).or(`completed_at.lte.${cutoff},and(status.eq.Cancelled,print_options->>queueExpiredAt.not.is.null)`).is('file_deleted_at',null).order('completed_at').limit(50);
    if(error) throw fail(503,'Unable to load cleanup candidates.');
    for(const order of orders||[]) {
      try { deletedFilesCount+=await deleteOrderFiles(client,order,now.getTime()); }
      catch { failures++; }
    }
    // Re-sweep expired upload capabilities, preserving any active order.
    const {data:intents,error:intentError}=await client.from('print_upload_intents').select('id,shop_id,object_key,order_id').lt('expires_at',cutoff).is('cleaned_at',null).order('expires_at').limit(50);
    if(intentError) throw fail(503,'Unable to load expired uploads.');
    for(const intent of intents||[]) {
      if(intent.order_id) {
        const {data:order,error:lookupError}=await client.from('orders').select('status,file_deleted_at').eq('id',intent.order_id).maybeSingle();
        if(lookupError){failures++;continue;}
        if(order&&!order.file_deleted_at) continue;
      }
      const {error:removeError}=await client.storage.from(BUCKET).remove([intent.object_key]);
      if(removeError){failures++;continue;}
      const {error:markError}=await client.from('print_upload_intents').update({cleaned_at:now.toISOString()}).eq('id',intent.id);
      if(markError){failures++;continue;}
      deletedFilesCount++;
    }
    return res.status(failures?503:200).json({success:failures===0,deletedFilesCount,expiredOrdersCount,failures,deletedOrdersCount:0,retentionMinutes:10,queueWaitMinutes:10});
  }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'Cleanup failed.'});}
}
