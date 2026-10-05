import test from 'node:test';
import assert from 'node:assert/strict';
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from '@zip.js/zip.js';
import { validateZip } from '../api/_lib/archives.js';
import { estimateFiles, uploadQueueProgress } from '../frontend/src/utils/upload.mjs';
import { dashboardGroups } from '../frontend/src/utils/dashboardOrders.mjs';
import { createSecureOrders } from '../api/_lib/orders.js';
import { hash } from '../api/_lib/security.js';
async function zip(entries) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  for (const entry of entries) await writer.add(entry.name, new Uint8ArrayReader(new TextEncoder().encode(entry.text || 'synthetic')), { level: 0, ...entry.options });
  return writer.close();
}
test('ZIP directory validation preserves archive bytes and does not inflate entries', async () => {
  const bytes = await zip([{name:'documents/a.pdf'}, {name:'images/a.png'}]), original = bytes.slice();
  assert.deepEqual(await validateZip(bytes), {archiveFiles:2});
  assert.deepEqual(bytes, original);
  await assert.rejects(validateZip(new TextEncoder().encode('not a zip')), /not a ZIP/);
  await assert.rejects(validateZip(bytes.slice(0,20)), /damaged/);
  await assert.rejects(validateZip(await zip([])), /at least one file/);
});
test('archives reject paths outside the extraction directory and symbolic links', async () => {
  for (const name of ['../outside.pdf', '/absolute.pdf', 'C:/outside.pdf', 'folder/../../outside.pdf', 'folder\\..\\outside.pdf']) {
    await assert.rejects(validateZip(await zip([{name}])), {status:400});
  }
  await assert.rejects(validateZip(await zip([{name:'link',options:{unixMode:0o120777}}])), /unsafe file paths/);
});
test('ZIP page/price remains unknown; normal file pricing remains separate', () => {
  const result=estimateFiles([{type:'zip',file:{name:'bundle.zip'},pages:null}, {type:'pdf',file:{name:'normal.pdf'},pages:3}],{rate:2.5});
  assert.deepEqual(result.estimates,[{pages:null,amount:null,pricePending:true},{pages:3,amount:7.5}]);
  assert.equal(result.totalPages,3); assert.equal(result.totalAmount,7.5); assert.equal(result.rangeError,'');
  const archive=dashboardGroups([{id:'zip-a',file_path:'shop-a/a.zip',file_name:'a.zip',status:'Pending',print_options:{fileKind:'zip'}}])[0];
  assert.equal(archive.isArchive,true); assert.equal(archive.isImageGroup,false);
});
test('retry progress starts with all retained uploaded bytes and stays monotonic', () => {
  const files=[{file:{size:25},uploadIntent:{}}, {file:{size:50}}, {file:{size:25},uploadIntent:{}}];
  const progress=uploadQueueProgress(files);
  assert.equal(progress.percent,50); assert.equal(progress.confirm(files[0]),50);
  assert.equal(progress.update(files[1],60),80); assert.equal(progress.update(files[1],40),80);
  assert.equal(progress.update(files[1],100),99); assert.equal(progress.confirm(files[1]),100);
  assert.equal(progress.confirm(files[2]),100);
});
test('server validates the original ZIP and builds a trusted pending-price item', async () => {
  process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='offline-only';process.env.REQUEST_LOG_SECRET='offline-only';
  const originalFetch=globalThis.fetch, bytes=await zip([{name:'safe.pdf'}]);
  const intentId='00000000-0000-4000-8000-000000000001',token='A'.repeat(43),orderId='00000000-0000-4000-8000-000000000002';
  let committed;
  globalThis.fetch=async (input,options={})=>{
    const url=new URL(String(input));
    if(url.pathname==='/rest/v1/rpc/print_rate_limit')return Response.json(true);
    if(url.pathname==='/rest/v1/print_upload_intents')return Response.json({id:intentId,shop_id:'shop-a',token_hash:hash(token),object_key:'shop-a/test.zip',mime_type:'application/zip',byte_size:bytes.length,expires_at:new Date(Date.now()+600000).toISOString()});
    if(url.pathname==='/storage/v1/object/print-jobs/shop-a/test.zip')return new Response(bytes);
    if(url.pathname==='/rest/v1/rpc/commit_print_orders'){committed=JSON.parse(options.body);return Response.json([orderId]);}
    throw Error('Unexpected request '+url.pathname);
  };
  try {
    const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
    await createSecureOrders({method:'POST',headers:{},body:{shopId:'shop-a',customerToken:token,orders:[{intentId,intentToken:token,print_type:'color',paper_size:'invalid',duplex:1,pages_to_print:999,total_amount:999,rangeType:'custom',rangeCustom:'bad'}]}},res);
    assert.equal(res.statusCode,200);assert.deepEqual(res.body.orderIds,[orderId]);
    assert.equal(committed.p_items[0].print_options.fileKind,'zip');assert.equal(committed.p_items[0].print_options.pricePending,true);
    assert.equal(committed.p_items[0].print_options.archiveFiles,1);assert.equal(committed.p_items[0].total_amount,undefined);
    assert.equal(committed.p_items[0].print_options.documentPages,undefined);
    assert.equal(committed.p_items[0].print_type,'bw');assert.equal(committed.p_items[0].paper_size,'A4');assert.equal(committed.p_items[0].duplex,0);
  } finally { globalThis.fetch=originalFetch; }
});
