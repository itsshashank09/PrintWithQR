import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardGroups, orderFiles, fetchGroupFiles } from '../frontend/src/utils/dashboardOrders.mjs';
import { imageZip } from '../frontend/src/utils/zip.mjs';
import { initialisePrintWindow, prepareImagePrint } from '../frontend/src/utils/imagePrint.mjs';
import { individualDownloads, triggerDownloads } from '../frontend/src/utils/imageDownloads.mjs';
const hash = 'a'.repeat(64);
const order = (id, extra = {}) => ({ id, shop_id:'shop-a', customer_access_hash:hash, status:'Pending', file_path:'shop-a/'+id+'.png', file_name:id+'.png', print_type:'bw', paper_size:'A4', duplex:0, pages_to_print:1, total_amount:5, created_at:'2026-10-02T12:00:00Z', ...extra });
test('one image group per checkout; customers, shops, PDFs and print settings stay separate', () => {
  const groups=dashboardGroups([order('b',{print_options:{batchIndex:1}}),order('a',{print_options:{batchIndex:0}}),order('customer-b',{customer_access_hash:'b'.repeat(64)}),order('shop-b',{shop_id:'shop-b'}),order('pdf',{file_path:'shop-a/pdf.pdf',file_name:'pdf.pdf'}),order('letter',{paper_size:'Letter'}),order('finished',{status:'Completed'}),order('cancelled',{status:'Cancelled'})]);
  assert.equal(groups.length,5);assert.deepEqual(groups[0].files.map(file=>file.name),['a.png','b.png']);
  assert.equal(groups[0].groupOrders.length,2);assert.equal(groups[0].total_amount,10);assert.equal(groups[0].pages_to_print,2);
  assert.equal(groups[3].isImageGroup,false);
  assert.equal(dashboardGroups([order('one',{customer_access_hash:null}),order('two',{customer_access_hash:null})]).length,2);
  const legacy=order('legacy',{file_path:'["shop-a/first.png","shop-a/second.jpg"]',file_name:'["first.png","second.jpg"]'});
  assert.deepEqual(orderFiles(legacy).map(file=>file.index),[0,1]);assert.equal(dashboardGroups([legacy])[0].files.length,2);
  const mixed=dashboardGroups([order('p'),order('q',{status:'Printing'})])[0];assert.equal(mixed.statusLabel,'1 waiting · 1 printing');
});
test('every file receives its own authorized URL; a missing image prevents a partial job',async()=>{
  const seen=[], files=dashboardGroups([order('a'),order('b')])[0].files;
  const options={projectUrl:'https://test.invalid',getFileUrl:async(id,index)=>{seen.push([id,index]);return 'https://test.invalid/storage/v1/object/sign/print-jobs/'+id+'.png?token=synthetic';},fetchImpl:async()=>new Response('synthetic-image')};
  const result=await fetchGroupFiles(files,options);assert.equal(result.length,2);assert.deepEqual(seen,[['a',0],['b',0]]);
  let requests=0;
  await assert.rejects(fetchGroupFiles(files,{...options,fetchImpl:async()=>++requests===1?new Response('synthetic-image'):new Response('',{status:410})}),/unavailable or expired/);
  await assert.rejects(fetchGroupFiles(files,{...options,getFileUrl:async()=> 'https://evil.example/storage/v1/object/sign/print-jobs/a.png?token=x'}),/not authorized/);
  const controller=new AbortController();controller.abort();await assert.rejects(fetchGroupFiles(files,{...options,signal:controller.signal}),{name:'AbortError'});
});
test('ZIP preserves bytes, Unicode and duplicate filenames without path traversal',async()=>{
  const data=[{name:'same.png',blob:new Blob(['123456789'])},{name:'same.png',blob:new Blob(['second'])},{name:'../नमस्ते.png',blob:new Blob(['unicode'])}];
  const archive=await imageZip(data), bytes=new Uint8Array(await archive.arrayBuffer()), view=new DataView(bytes.buffer), decoder=new TextDecoder();
  const names=[], contents=[], offsets=[];let at=0;
  while(view.getUint32(at,true)===0x04034b50){
    offsets.push(at);assert.equal(view.getUint16(at+6,true),0x800);assert.equal(view.getUint16(at+8,true),0);
    const length=view.getUint16(at+26,true),size=view.getUint32(at+18,true);
    names.push(decoder.decode(bytes.slice(at+30,at+30+length)));contents.push(decoder.decode(bytes.slice(at+30+length,at+30+length+size)));
    if(names.length===1)assert.equal(view.getUint32(at+14,true),0xcbf43926);
    at+=30+length+size;
  }
  assert.deepEqual(names,['same.png','same (2).png','_नमस्ते.png']);assert.deepEqual(contents,['123456789','second','unicode']);
  const directoryStart=at;
  for(let n=0;n<3;n++){assert.equal(view.getUint32(at,true),0x02014b50);assert.equal(view.getUint32(at+42,true),offsets[n]);at+=46+view.getUint16(at+28,true);}
  assert.equal(view.getUint32(at,true),0x06054b50);assert.equal(view.getUint16(at+10,true),3);assert.equal(view.getUint32(at+16,true),directoryStart);assert.equal(view.getUint32(at+12,true),at-directoryStart);
  const controller=new AbortController();controller.abort();await assert.rejects(imageZip(data,{signal:controller.signal}),{name:'AbortError'});
});
function fakeWindow() {
  const nodes = new Map(), images=[];
  const element = tag => ({tag,children:[],appendChild(value){this.children.push(value);},naturalWidth:20,naturalHeight:20,decode:async()=>{}});
  const doc={open(){},write(html){this.html=html;},close(){},head:element('head'),createElement(tag){const node=element(tag);if(tag==='img')images.push(node);return node;},getElementById(id){if(!nodes.has(id))nodes.set(id,element('main'));return nodes.get(id);}};
  return {document:doc,closed:false,images};
}
test('combined print preparation waits for every decoded image and renders one page per image',async()=>{
  const win=fakeWindow(),revoked=[];initialisePrintWindow(win);assert.match(win.document.html,/noindex/);assert.match(win.document.html,/no-referrer/);
  const files=[{name:'a.png',blob:new Blob(['a']),paperSize:'A4',printType:'bw'},{name:'b.png',blob:new Blob(['b']),paperSize:'A4',printType:'bw'}];
  let ready=false;const pending=prepareImagePrint(win,files,{createUrl:()=> 'blob:synthetic-'+win.images.length,revokeUrl:url=>revoked.push(url)}).then(cleanup=>{ready=true;return cleanup;});
  assert.equal(win.images.length,2);await win.images[0].onload();assert.equal(ready,false);
  await win.images[1].onload();const cleanup=await pending;assert.equal(ready,true);assert.equal(win.document.getElementById('image-pages').children.length,2);
  assert.match(win.document.head.children[0].textContent,/210mm/);assert.match(win.document.head.children[0].textContent,/grayscale/);assert.match(win.document.head.children[0].textContent,/last-child.*break-after:auto/);
  cleanup();cleanup();assert.equal(revoked.length,2);
});
test('image render failure prevents readiness and releases private blob URLs',async()=>{
  const win=fakeWindow(),revoked=[],files=[{name:'bad.png',blob:new Blob(['bad']),paperSize:'Letter'},{name:'not-yet-loaded.png',blob:new Blob(['other']),paperSize:'Letter'}];
  const pending=prepareImagePrint(win,files,{createUrl:()=> 'blob:synthetic',revokeUrl:url=>revoked.push(url)});
  win.images[0].onerror();await assert.rejects(pending,/Nothing was printed/);assert.deepEqual(revoked,['blob:synthetic','blob:synthetic']);assert.equal(win.images[1].onload,null);
  await assert.rejects(prepareImagePrint(fakeWindow(),[{...files[0],paperSize:'unknown'}]),/matching paper/);
});
test('batch authorization runs once; transfers overlap within the bound and retain selection order', async () => {
  const files = dashboardGroups(Array.from({length:5}, (_, n) => order('parallel-'+n)))[0].files;
  let signed = 0, active = 0, maximum = 0;
  const waiting = [], completed = [];
  const job = fetchGroupFiles(files, {
    projectUrl:'https://test.invalid', getFileUrls:async refs => { signed++; return refs.map(ref=>({...ref,url:'https://test.invalid/storage/v1/object/sign/print-jobs/'+ref.orderId+'.png?token=test'})); },
    fetchImpl: url => new Promise(resolve => { active++; maximum = Math.max(maximum, active); waiting.push(()=> { active--; resolve(new Response(url)); }); }),
    onProgress: value => completed.push(value)
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(signed,1); assert.equal(active,4); assert.equal(waiting.length,4);
  waiting[3](); await new Promise(resolve=>setImmediate(resolve)); assert.equal(waiting.length,5);
  waiting[4](); waiting[2](); waiting[1](); waiting[0]();
  const result = await job;
  assert.equal(maximum,4); assert.deepEqual(result.map(file=>file.orderId),files.map(file=>file.orderId)); assert.equal(completed.at(-1),'Prepared 5 of 5 images…');
  await assert.rejects(fetchGroupFiles(files,{projectUrl:'https://test.invalid',getFileUrls:async()=> []}),/not authorized/);
});
test('bulk download requests original files individually with safe unique filenames and cleanup', () => {
  const revoked = [], original = [], files = [{name:'same.png',blob:new Blob(['first'])},{name:'same.png',blob:new Blob(['second'])},{name:'../नमस्ते.png',blob:new Blob(['third'])}];
  const prepared = individualDownloads(files,{createUrl:blob=>{original.push(blob);return 'blob:test-'+original.length;},revokeUrl:url=>revoked.push(url)});
  const requested = [], removed = [], doc = {body:{appendChild(){}},createElement(){return {click(){requested.push([this.download,this.href]);},remove(){removed.push(this.href);}};}};
  triggerDownloads(prepared.links,doc);
  assert.deepEqual(requested.map(row=>row[0]),['same.png','same (2).png','_नमस्ते.png']); assert.equal(removed.length,3);
  assert.deepEqual(original,files.map(file=>file.blob)); assert.ok(!requested.some(row=>row[0].endsWith('.zip')));
  prepared.cleanup(); prepared.cleanup(); assert.equal(revoked.length,3);
});
