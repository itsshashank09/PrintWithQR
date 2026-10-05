import test from 'node:test';
import assert from 'node:assert/strict';
import { RECEIPT_KEY, RECEIPT_TTL, saveReceipt, readReceipts, readTrackingToken, receiptLink, forgetReceipt, newOrderToken } from '../frontend/src/utils/customerOrders.mjs';
import { countPdfPages, estimateFiles, selectedPageCount, uploadWithProgress } from '../frontend/src/utils/upload.mjs';
import { PDFDocument } from 'pdf-lib';
import { pageSelection, hash } from '../api/_lib/security.js';
import platform from '../api/platform.js';

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const token = 'A'.repeat(43);
test('closing a tab preserves a minimal receipt and tracking stays out of HTTP URLs', () => {
  globalThis.localStorage = memory(); globalThis.sessionStorage = memory();
  assert.equal(saveReceipt({ shopId: 'shop-a', orderIds: ['order-a','order-b'], token, filename: 'private.pdf', url: 'private-document-url' }), true);
  globalThis.sessionStorage = memory();
  assert.equal(readTrackingToken('order-b'), token);
  assert.deepEqual(Object.keys(readReceipts()[0]).sort(), ['createdAt','orderIds','shopId','token']);
  const url = new URL(receiptLink('https://printwithqr.in', 'order-a', token));
  assert.equal(url.search, ''); assert.equal(url.hash, '#track='+token);
  assert.equal(readTrackingToken('order-a', url.hash), token);
  forgetReceipt('order-a'); assert.equal(readTrackingToken('order-b'), null);
});
test('expired, malformed and excessive receipts are removed; blocked storage fails safely', () => {
  const store = memory(), now = 1000000000;
  saveReceipt({ shopId:'shop-a', orderIds:['order-a'], token }, store, now);
  assert.equal(readReceipts(store, now + RECEIPT_TTL - 1).length, 1);
  assert.equal(readReceipts(store, now + RECEIPT_TTL).length, 0);
  assert.equal(store.getItem(RECEIPT_KEY), '[]');
  store.setItem(RECEIPT_KEY, 'bad-json'); assert.deepEqual(readReceipts(store), []);
  const blocked = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } };
  assert.equal(saveReceipt({shopId:'shop-a',orderIds:['order-a'],token},blocked),false);
  assert.deepEqual(readReceipts(blocked), []);
  for (let n=0;n<25;n++) saveReceipt({shopId:'shop-a',orderIds:['order-'+n],token:String(n).padStart(43,'B')},store,now);
  assert.equal(readReceipts(store, now).length,20);
  assert.throws(()=>receiptLink('javascript:alert(1)','order-a',token));
});
test('tracking tokens have 256-bit randomness; page estimates agree with server validation', () => {
  const a = newOrderToken(), b = newOrderToken(); assert.match(a,/^[A-Za-z0-9_-]{43}$/); assert.notEqual(a,b);
  for (const input of [[9,'all'],[9,'odd'],[9,'even'],[9,'custom','1-3, 3, 8'],[1,'even']]) assert.equal(selectedPageCount(...input),pageSelection(...input));
  for (const input of [[0,'all'],[2001,'all'],[2,'custom','1-99'],[2,'custom','-1'],[2,'custom','2-1'],[2,'custom','1,']]) assert.throws(()=>selectedPageCount(...input));
});
test('PDF page counts and per-file prices include all documents and images in the checkout', async () => {
  async function document(pages) { const pdf=await PDFDocument.create(); for(let n=0;n<pages;n++)pdf.addPage([200,300]); return pdf.save(); }
  const first=await countPdfPages(await document(3)),second=await countPdfPages(await document(2));
  assert.equal(first,3);assert.equal(second,2);
  const files=[{file:{name:'three.pdf'},pages:first},{file:{name:'two.pdf'},pages:second},{file:{name:'one.png'},pages:1},{file:{name:'two.png'},pages:1}];
  const result=estimateFiles(files,{rate:2.5});
  assert.equal(result.rangeError,'');assert.equal(result.totalPages,7);assert.equal(result.totalAmount,17.5);
  assert.deepEqual(result.estimates.map(file=>file.amount),[7.5,5,2.5,2.5]);
  const selection=estimateFiles([{file:{name:'five.pdf'},pages:await countPdfPages(await document(5))}],{rate:10,rangeType:'custom',rangeCustom:'1,3'});
  assert.equal(selection.totalPages,2);assert.equal(selection.totalAmount,20);
  assert.match(estimateFiles(files,{rate:-1}).rangeError,/rate is unavailable/);
  await assert.rejects(countPdfPages(new Uint8Array([1,2,3])),/PDF/);
});
class FakeXHR {
  upload = {}; headers = {}; status = 200;
  open(method,url) { this.method=method;this.url=url; }
  setRequestHeader(key,value) {this.headers[key]=value;}
  send(data) {this.data=data;}
  abort() {this.onabort();}
}
const uploadArgs = xhr => ({url:'https://test.invalid/storage/v1/object/upload/sign/print-jobs/shop-a/file.pdf?token=signed',projectUrl:'https://test.invalid',file:new File(['synthetic'], 'synthetic.pdf', {type:'application/pdf'}),xhrFactory:()=>xhr});
test('signed upload reports real byte progress and uses the Storage multipart protocol', async () => {
  const xhr=new FakeXHR(), seen=[];
  const pending=uploadWithProgress({...uploadArgs(xhr),onProgress:n=>seen.push(n)});
  assert.equal(xhr.method,'PUT');assert.equal(xhr.headers['x-upsert'],'false');
  assert.equal(xhr.data.get('cacheControl'),'3600');assert.equal(xhr.data.get('').name,'synthetic.pdf');
  xhr.upload.onprogress({lengthComputable:true,loaded:20,total:100});
  xhr.upload.onprogress({lengthComputable:false,loaded:90,total:100});
  assert.deepEqual(seen,[20]);xhr.onload();await pending;assert.deepEqual(seen,[20,100]);
});
test('network failures and pause reject uploads; foreign upload destinations are blocked', async () => {
  let xhr=new FakeXHR(), seen=[];let pending=uploadWithProgress({...uploadArgs(xhr),onProgress:n=>seen.push(n)});
  xhr.onerror();await assert.rejects(pending,/Connection lost/);assert.deepEqual(seen,[]);
  xhr=new FakeXHR();const controller=new AbortController();pending=uploadWithProgress({...uploadArgs(xhr),signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
  for (const url of ['https://evil.example/storage/v1/object/upload/sign/print-jobs/f.pdf?token=x','https://test.invalid/storage/v1/object/upload/sign/other/f.pdf?token=x','https://test.invalid/storage/v1/object/upload/sign/print-jobs/f.pdf']) assert.throws(()=>uploadWithProgress({...uploadArgs(new FakeXHR()),url}),/authorization/);
});
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
const json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
test('batch status requires the anchor capability and isolates one shop and token; no file access is returned',async()=>{
  process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='offline-only';
  const calls=[];
  globalThis.fetch=async input=>{
    const url=new URL(String(input));calls.push(url);
    assert.equal(url.pathname,'/rest/v1/orders');
    assert.equal(url.searchParams.get('customer_access_hash'),'eq.'+hash(token));
    if(url.searchParams.has('id')){
      assert.equal(url.searchParams.get('id'),'eq.order-a');
      return json({id:'order-a',shop_id:'shop-a',customer_access_hash:hash(token),shops:{name:'Synthetic'},file_name:'a.pdf',total_amount:10});
    }
    assert.equal(url.searchParams.get('shop_id'),'eq.shop-a');assert.equal(url.searchParams.get('limit'),'10');
    assert.doesNotMatch(url.searchParams.get('select'),/file_path|customer_access_hash|phone|token/);
    return json([{id:'order-a',file_name:'a.pdf',total_amount:10},{id:'order-b',file_name:'b.pdf',total_amount:15}]);
  };
  const req={method:'GET',headers:{'x-order-token':token},query:{action:'customer_status',orderId:'order-a'}};
  let res=response();await platform(req,res);assert.equal(res.statusCode,200);assert.equal(res.body.orders.length,2);assert.equal(res.body.shop.id,'shop-a');
  assert.doesNotMatch(JSON.stringify(res.body),/customer_access_hash|file_path|https:|download/);assert.match(res.headers['Cache-Control'],/no-store/);assert.equal(calls.length,2);
  let deniedCalls=0;globalThis.fetch=async()=>{deniedCalls++;return json(null);};
  res=response();await platform({...req,headers:{'x-order-token':'B'.repeat(43)}},res);assert.equal(res.statusCode,404);assert.equal(deniedCalls,1);
  res=response();await platform({...req,headers:{}},res);assert.equal(res.statusCode,404);assert.equal(deniedCalls,1);
});
