// Uses only accounts and documents created by this test. Never enumerate customers.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
// Explicit credentials for a disposable project only; never load application .env.
const local=parseEnv(readFileSync(new URL('../.env.integration.local',import.meta.url),'utf8'));
for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','TEST_SUPABASE_PROJECT_REF']) {
  if(!local[key]) throw new Error(`Missing ${key} in .env.integration.local`);
  process.env[key]=local[key];
}
const testRef=process.env.TEST_SUPABASE_PROJECT_REF;
assert.match(testRef,/^[a-z]{20}$/);
assert.notEqual(testRef,'lvtmbhxjkuocohcdwclu','Production project is forbidden');
assert.equal(process.env.SUPABASE_URL,`https://${testRef}.supabase.co`);
assert.equal(process.argv.length,2,'This test has no live/production mode or remote endpoint option');
process.env.REQUEST_LOG_SECRET=crypto.randomBytes(32).toString('hex');
process.env.PRINT_CLEANUP_SECRET=crypto.randomBytes(32).toString('hex');
const locked=true, customerFlow=true;
const api=await import('../api/platform.js'),ordersApi=await import('../api/create-print-order.js'),cleanupApi=await import('../api/cleanup.js');
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey=process.env.SUPABASE_ANON_KEY;
const anon=createClient(process.env.SUPABASE_URL,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
const syntheticUsers=[],keys=[];let checks=0;
function ok(value,message){assert.ok(value,message);checks++;console.log('PASS '+message);}
async function call(action,input={},token,method='POST',extra={}){
  const headers={'Content-Type':'application/json',...extra};if(token)headers.authorization='Bearer '+token;
  const endpoint=action==='create'?'create-print-order':action==='cleanup'?'cleanup':'platform';
  const query={...(endpoint==='platform'?{action}:{}),...(method==='GET'?input:{})};
  const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}};
  const handler=endpoint==='platform'?api.default:endpoint==='cleanup'?cleanupApi.default:ordersApi.default;
  await handler({method,headers,query,body:input,socket:{remoteAddress:'synthetic-test'}},res);
  return{status:res.statusCode,body:res.body};
}
try{
  for(let n=0;n<2;n++){
    const password=crypto.randomBytes(24).toString('base64url');
    const email=`security-test-${crypto.randomUUID()}@example.invalid`;
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
    const id=data.user.id;syntheticUsers.push({id});
    const {error:shopError}=await admin.from('shops').insert({id,name:'PrintWithQR synthetic security test',address:'Synthetic only',bw_rate:5,color_rate:10,color_enabled:1,is_paid:0,is_admin:false,subscription_status:'free',free_prints_allowed:10,free_prints_used:0});if(shopError)throw shopError;
    const {error:memberError}=await admin.from('shop_members').insert({shop_id:id,user_id:id,role:'owner',active:true});if(memberError)throw memberError;
    const client=createClient(process.env.SUPABASE_URL,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const auth=await client.auth.signInWithPassword({email,password});if(auth.error)throw auth.error;
    Object.assign(syntheticUsers[n],{client,token:auth.data.session.access_token});
  }
  const [a,b]=syntheticUsers;
  const shop=await call('public_shop',{shopId:a.id},null,'GET');ok(shop.status===200&&!('is_admin'in shop.body.shop)&&!('phone'in shop.body.shop),'public shop returns only allowed fields');
  const account=await call('me',{},a.token,'GET');ok(account.status===200&&account.body.shops.length===1&&!account.body.isAdmin,'authenticated owner resolves verified membership');
  const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const bytes=await pdf.save();
  const createIntent=async()=>{
    const r=await call('upload_intent',{shopId:a.id,name:'synthetic.pdf',mime:'application/pdf',size:bytes.length});ok(r.status===200,'guest obtains exact-object upload authorization');
    keys.push(r.body.path);
    if(customerFlow){
      const data=new FormData();data.append('cacheControl','3600');data.append('',new File([bytes],'synthetic.pdf',{type:'application/pdf'}));
      const upload=await fetch(r.body.uploadUrl,{method:'PUT',headers:{'x-upsert':'false'},body:data});
      ok(upload.ok,'native multipart upload succeeds with only the signed upload URL');
    }else{
      const upload=await anon.storage.from('print-jobs').uploadToSignedUrl(r.body.path,r.body.uploadToken,bytes,{contentType:'application/pdf'});ok(!upload.error,'guest uploads synthetic PDF using signed capability');
    }
    return r.body;
  };
  const intent=await createIntent();
  if(locked){
    const list=await anon.storage.from('print-jobs').list(a.id);ok(!!list.error||list.data?.length===0,'anonymous cannot list synthetic private files');
    const sign=await anon.storage.from('print-jobs').createSignedUrl(intent.path,60);ok(!!sign.error,'anonymous cannot mint document download URLs');
    const directOwnerSign=await a.client.storage.from('print-jobs').createSignedUrl(intent.path,60);ok(!!directOwnerSign.error,'authenticated browser must use server authorization for signed URLs');
    const remove=await anon.storage.from('print-jobs').remove([intent.path]);ok(!!remove.error||remove.data?.length===0,'anonymous cannot delete synthetic private file');
  }
  const customerToken=crypto.randomBytes(32).toString('base64url');
  const item={intentId:intent.intentId,intentToken:intent.intentToken,print_type:'bw',paper_size:'A4',duplex:0,rangeType:'all',pages_to_print:1999,total_amount:0,file_path:b.id+'/stolen.pdf'};
  const wrongShop=await call('create',{shopId:b.id,orders:[item],customerToken});ok(wrongShop.status===403,'upload cannot create an order for another shop');
  const duplicate=await call('create',{shopId:a.id,orders:[item,item],customerToken});ok(duplicate.status===400,'duplicate upload intents are rejected');
  const items=[item];
  if(customerFlow){const second=await createIntent();items.push({...item,intentId:second.intentId,intentToken:second.intentToken});}
  const created=await call('create',{shopId:a.id,orders:items,customerToken});ok(created.status===200&&created.body.orderIds.length===items.length,'customer creates authorized print order for every submitted file');
  const orderId=created.body.orderIds[0];
  const retry=await call('create',{shopId:a.id,orders:items,customerToken});ok(retry.status===200&&JSON.stringify(retry.body.orderIds)===JSON.stringify(created.body.orderIds),'order retries are idempotent for the complete batch');
  const own=await call('customer_status',{orderId},null,'GET',{'x-order-token':customerToken});ok(own.status===200&&Number(own.body.order.total_amount)===10&&own.body.order.pages_to_print===2&&!('file_path'in own.body.order),'actual PDF pages and server rates override forged client values');
  if(customerFlow){
    ok(own.body.orders.length===2&&own.body.orders.reduce((sum,row)=>sum+Number(row.total_amount),0)===20,'customer receipt includes every file and its server-confirmed price');
    ok(own.body.shop.id===a.id&&!/file_path|customer_access_hash|signedUrl|uploadToken/.test(JSON.stringify(own.body)),'receipt exposes status metadata without document access');
    const fromSecond=await call('customer_status',{orderId:created.body.orderIds[1]},null,'GET',{'x-order-token':customerToken});
    ok(fromSecond.status===200&&fromSecond.body.orders.length===2,'either order address recovers the complete receipt');
    const strangerIntent=await createIntent(), strangerToken=crypto.randomBytes(32).toString('base64url');
    const stranger=await call('create',{shopId:a.id,orders:[{...item,intentId:strangerIntent.intentId,intentToken:strangerIntent.intentToken}],customerToken:strangerToken});
    ok(stranger.status===200,'separate synthetic customer creates a separate checkout');
    const isolated=await call('customer_status',{orderId},null,'GET',{'x-order-token':customerToken});
    ok(isolated.body.orders.length===2&&!isolated.body.orders.some(row=>stranger.body.orderIds.includes(row.id)),'another customer in the same shop is excluded from the receipt');
    const deniedStranger=await call('customer_status',{orderId},null,'GET',{'x-order-token':strangerToken});
    ok(deniedStranger.status===404,'a different valid customer token cannot read this batch');
  }
  const other=await call('customer_status',{orderId},null,'GET',{'x-order-token':crypto.randomBytes(32).toString('base64url')});ok(other.status===404,'another customer cannot read order status');
  const allowed=await call('file_url',{orderId},a.token);ok(allowed.status===200&&allowed.body.expiresIn<=120,'owning shop obtains short-lived authorized file access');
  const denied=await call('file_url',{orderId},b.token);ok(denied.status===403,'another shop cannot access a document');
  const statusDenied=await call('status',{orderId,status:'Printing'},b.token);ok(statusDenied.status===403,'another shop cannot update order status');
  const adminDenied=await call('admin',{},a.token,'GET');ok(adminDenied.status===403,'ordinary shop cannot become platform administrator');
  if(locked){
    const ownRows=await a.client.from('orders').select('id').eq('id',orderId);ok(ownRows.data?.length===1,'RLS permits owner dashboard to read its order');
    const otherRows=await b.client.from('orders').select('id').eq('id',orderId);ok(!otherRows.error&&otherRows.data?.length===0,'RLS prevents cross-shop direct reads');
    const anonRows=await anon.from('orders').select('id').eq('id',orderId);ok(!!anonRows.error||anonRows.data?.length===0,'anonymous direct order read denied');
    const mutate=await a.client.from('shops').update({is_admin:true}).eq('id',a.id);ok(!!mutate.error,'browser cannot modify admin or billing state');
    const rpc=await anon.rpc('delete_old_print_jobs');ok(!!rpc.error,'anonymous cannot execute old cleanup function');
    const commit=await anon.rpc('commit_print_orders',{p_shop_id:a.id,p_items:[],p_access_hash:'x'});ok(!!commit.error,'anonymous cannot call privileged order commit RPC');
  }
  const print=await call('status',{orderId,status:'Printing'},a.token);ok(print.status===200,'authorized shop starts printing');
  const complete=await call('status',{orderId,status:'Completed'},a.token);ok(complete.status===200,'authorized shop completes printing');
  const reopen=await call('status',{orderId,status:'Pending'},a.token);ok(reopen.status===409,'completed job cannot be reopened across cleanup');
  // Only this synthetic record is aged to test retention.
  await admin.from('orders').update({completed_at:new Date(Date.now()-660000).toISOString()}).eq('id',orderId);
  const expired=await call('file_url',{orderId},a.token);ok(expired.status===410,'expired document access is denied before cleanup');
  const activeIntent=await createIntent();
  const active=await call('create',{shopId:a.id,orders:[{...item,intentId:activeIntent.intentId,intentToken:activeIntent.intentToken}],customerToken});
  ok(active.status===200,'active control order created for cleanup verification');
  ok((await call('cleanup',{},null)).status===401,'cleanup rejects requests without the worker secret');
  const cleanup=await call('cleanup',{},process.env.PRINT_CLEANUP_SECRET);
  ok(cleanup.status===200&&cleanup.body.failures===0,'authenticated cleanup succeeds against isolated Storage');
  const removed=await admin.from('orders').select('file_deleted_at').eq('id',orderId).single();
  ok(!!removed.data?.file_deleted_at,'cleanup marks eligible synthetic document deleted');
  const files=await admin.storage.from('print-jobs').list(a.id);
  ok(!files.error&&!files.data.some(f=>f.name===intent.path.split('/')[1]),'cleanup removes the expired synthetic file from Storage');
  ok(files.data.some(f=>f.name===activeIntent.path.split('/')[1]),'cleanup preserves the pending control file');
  const saved=await admin.from('orders').select('id').eq('id',orderId);
  ok(saved.data?.length===1,'cleanup preserves completed order metadata');
  console.log(JSON.stringify({success:true,checks,mode:'source API handlers with isolated Supabase Auth, Postgres and Storage',locked}));
}finally{
  if(keys.length)await admin.storage.from('print-jobs').remove(keys);
  for(const {id}of syntheticUsers){
    await admin.from('orders').delete().eq('shop_id',id);
    await admin.from('shops').delete().eq('id',id);
    await admin.auth.admin.deleteUser(id);
  }
}
