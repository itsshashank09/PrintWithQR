import test from 'node:test';
import assert from 'node:assert/strict';
import { pageSelection, objectKey, fileKeys, hash, secret } from '../api/_lib/security.js';
import platform from '../api/platform.js';
import cleanup from '../api/cleanup.js';
process.env.SUPABASE_URL='https://test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='offline-only';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
globalThis.fetch=async()=>{throw new Error('Network forbidden in unit tests');};

test('page ranges count actual document pages and reject invalid input',()=>{
  assert.equal(pageSelection(9,'all'),9);
  assert.equal(pageSelection(9,'odd'),5);
  assert.equal(pageSelection(9,'even'),4);
  assert.equal(pageSelection(9,'custom','1-3, 3, 8'),4);
  for(const args of [[2,'custom','1-99'],[2,'custom','-1'],[2,'custom','2-1'],[2,'bogus'],[2001,'all']]) assert.throws(()=>pageSelection(...args));
});
test('file references are restricted to the authorized shop and project bucket',()=>{
  assert.equal(objectKey('shop-a/file.pdf','shop-a'),'shop-a/file.pdf');
  assert.equal(objectKey('https://test.invalid/storage/v1/object/public/print-jobs/shop-a/file.pdf','shop-a'),'shop-a/file.pdf');
  for(const value of ['shop-b/file.pdf','shop-a/../file.pdf','https://evil.example/print-jobs/shop-a/file.pdf','shop-a/file.pdf?token=x','shop-a\\file.pdf']) assert.throws(()=>objectKey(value,'shop-a'));
  assert.deepEqual(fileKeys({shop_id:'shop-a',file_path:'["shop-a/a.pdf","shop-a/b.pdf"]'}),['shop-a/a.pdf','shop-a/b.pdf']);
});
test('customer capabilities have cryptographic entropy and are stored as hashes',()=>{
  const a=secret(),b=secret();assert.equal(a.length,43);assert.notEqual(a,b);assert.equal(hash(a).length,64);assert.notEqual(hash(a),a);
});
test('private APIs deny anonymous access before making database requests',async()=>{
  for(const [action,method] of [['me','GET'],['admin','GET'],['file_url','POST'],['file_urls','POST'],['status','POST'],['admin_update','POST']]){
    const res=response();await platform({method,headers:{},query:{action},body:{}},res);assert.equal(res.statusCode,401,action);assert.match(res.headers['X-Robots-Tag'],/noindex/);
  }
});
test('customer status requires a capability and rejects untrusted origins',async()=>{
  let res=response();await platform({method:'GET',headers:{},query:{action:'customer_status',orderId:'known-id'}},res);assert.equal(res.statusCode,404);
  res=response();await platform({method:'POST',headers:{origin:'https://attacker.vercel.app'},query:{action:'file_url'},body:{}},res);assert.equal(res.statusCode,403);
});

test('cleanup filters expired waiting and eligible terminal files, keeps records, and reports retries',async()=>{
  process.env.CRON_SECRET='offline-cleanup-secret';delete process.env.PRINT_CLEANUP_SECRET;
  let removed=[],marked=0;
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(String(input)),method=options.method||'GET';
    if(url.pathname==='/rest/v1/orders'&&method==='GET'){
      if(url.searchParams.get('status')==='eq.Pending') {
        assert.match(url.searchParams.get('created_at'),/^lte\./);return json([]);
      }
      assert.equal(url.searchParams.get('status'),'in.(Completed,Cancelled)');
      assert.match(url.searchParams.get('or'),/completed_at\.lte\..*queueExpiredAt\.not\.is\.null/);
      assert.equal(url.searchParams.get('file_deleted_at'),'is.null');
      return json([{id:'completed',shop_id:'shop-a',file_path:'shop-a/completed.pdf'}]);
    }
    if(url.pathname==='/rest/v1/print_upload_intents'&&method==='GET')return json([]);
    if(url.pathname==='/storage/v1/object/print-jobs'&&method==='DELETE'){
      removed=JSON.parse(options.body).prefixes;return json([]);
    }
    if(url.pathname==='/rest/v1/orders'&&method==='PATCH'){marked++;return json([]);}
    throw new Error('Unexpected cleanup operation: '+method+' '+url.pathname);
  };
  let res=response();await cleanup({method:'GET',headers:{authorization:'Bearer offline-cleanup-secret'}},res);
  assert.equal(res.statusCode,200);assert.deepEqual(removed,['shop-a/completed.pdf']);assert.equal(marked,1);assert.equal(res.body.deletedOrdersCount,0);
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(String(input));
    if(url.pathname==='/rest/v1/orders')return json(url.searchParams.get('status')==='eq.Pending'?[]:[{id:'completed',shop_id:'shop-a',file_path:'shop-a/completed.pdf'}]);
    if(url.pathname==='/rest/v1/print_upload_intents')return json([]);
    if(options.method==='DELETE')return json({message:'Temporary failure'},500);
    throw new Error('Failed deletions must not be marked successful');
  };
  res=response();await cleanup({method:'GET',headers:{authorization:'Bearer offline-cleanup-secret'}},res);
  assert.equal(res.statusCode,503);assert.equal(res.body.success,false);assert.equal(res.body.failures,1);
});
