import test from 'node:test';
import assert from 'node:assert/strict';
import { signedFileBatch } from '../api/_lib/file-access.js';
const idA = '11111111-1111-4111-8111-111111111111', idB = '22222222-2222-4222-8222-222222222222';
const order = (id, extra={}) => ({id,shop_id:'shop-a',file_path:'shop-a/'+id+'.png',status:'Pending',created_at:new Date().toISOString(),...extra});
const refs = [{orderId:idB,index:0},{orderId:idA,index:0}];
function fake(rows, {authorized=true,missingFile=false,conflict=false}={}) {
  const signed=[],updates=[];
  const client={from(table){
    let fields, selected=rows;
    const q={
      select(){if(!fields)return q;updates.push({fields,ids:selected.map(row=>row.id)});if(conflict)return Promise.resolve({data:[]});selected.forEach(row=>Object.assign(row,fields));return Promise.resolve({data:selected.map(row=>({id:row.id}))});},
      update(value){fields=value;return q;},
      eq(key,value){if(fields)selected=selected.filter(row=>row[key]===value);return q;},
      gt(key,value){selected=selected.filter(row=>row[key]>value);return q;},
      in(field,ids){selected=rows.filter(row=>ids.includes(row.id));return fields?q:Promise.resolve({data:selected});},
      maybeSingle:async()=>({data:table==='platform_admins'?null:authorized?{role:'owner'}:null})
    };return q;
  },storage:{from(bucket){assert.equal(bucket,'print-jobs');return {createSignedUrls:async(paths,ttl)=>{signed.push({paths,ttl});return {data:paths.map((path,index)=>({path,signedUrl:missingFile&&index===1?null:'https://test.invalid/'+path,error:missingFile&&index===1?'missing':null}))};}};}}};
  return {client,signed,updates};
}
test('batch signs only validated authorized keys, once, in requested order',async()=>{
  const {client,signed}=fake([order(idA),order(idB)]);
  const result=await signedFileBatch(client,'owner',refs);
  assert.equal(signed.length,1);assert.deepEqual(signed[0].paths,['shop-a/'+idB+'.png','shop-a/'+idA+'.png']);assert.equal(result.expiresIn,120);assert.deepEqual(result.files.map(file=>file.orderId),[idB,idA]);
});

test('ZIP download remains authorized while print preparation is rejected before signing or status changes',async()=>{
  const {client,signed,updates}=fake([order(idA,{file_path:'shop-a/archive.zip'})]);
  const files=[{orderId:idA,index:0}];
  await assert.rejects(signedFileBatch(client,'owner',files,{startPrinting:true}),{status:400});
  assert.equal(signed.length,0);assert.equal(updates.length,0);
  assert.equal((await signedFileBatch(client,'owner',files)).files.length,1);
  assert.equal(updates.length,0);
});
test('no part of a batch is signed when any document is unauthorized, expired, missing or malformed',async()=>{
  for(const [rows,options,input,status] of [
    [[order(idA),order(idB)],{authorized:false},refs,403],
    [[order(idA),order(idB,{shop_id:'other-shop'})],{},refs,403],
    [[order(idA),order(idB,{file_deleted_at:new Date().toISOString()})],{},refs,410],
    [[order(idA),order(idB,{status:'Completed',completed_at:new Date(Date.now()-601000).toISOString()})],{},refs,410],
    [[order(idA),order(idB,{status:'Cancelled',completed_at:null})],{},refs,410],
    [[order(idA)],{},refs,404],
    [[order(idA),order(idB,{file_path:'other-shop/private.png'})],{},refs,403],
    [[order(idA),order(idB)],{},[{orderId:idA,index:2}],400],
    [[order(idA),order(idB)],{},[{orderId:idA,index:'0'}],400]
  ]) {
    const {client,signed,updates}=fake(rows,options);
    await assert.rejects(signedFileBatch(client,'owner',input,{startPrinting:true}),error=>error.status===status);assert.equal(signed.length,0);assert.equal(updates.length,0);
  }
});
test('authorized print preparation marks only the selected pending jobs, and retries skip writes',async()=>{
  const rows=[order(idA),order(idB,{status:'Printing'})], {client,updates}=fake(rows);
  const result=await signedFileBatch(client,'owner',refs,{startPrinting:true});
  assert.equal(result.printingStarted,true);assert.deepEqual(updates,[{fields:{status:'Printing'},ids:[idA]}]);
  await signedFileBatch(client,'owner',refs,{startPrinting:true});assert.equal(updates.length,1);
  const download=fake([order(idA),order(idB)]);await signedFileBatch(download.client,'owner',refs);assert.equal(download.updates.length,0);
  const missing=fake([order(idA),order(idB)],{missingFile:true});await assert.rejects(signedFileBatch(missing.client,'owner',refs,{startPrinting:true}),error=>error.status===410);assert.equal(missing.updates.length,0);
  const conflict=fake([order(idA),order(idB)],{conflict:true});await assert.rejects(signedFileBatch(conflict.client,'owner',refs,{startPrinting:true}),error=>error.status===409);
});
test('batch URL lifetime respects remaining retention; signing failure returns no partial URLs',async()=>{
  const {client,signed}=fake([order(idA),order(idB,{status:'Completed',completed_at:new Date(Date.now()-580000).toISOString()})]);
  await signedFileBatch(client,'owner',refs);assert.ok(signed[0].ttl>=1&&signed[0].ttl<=20);
  const missing=fake([order(idA),order(idB)],{missingFile:true});await assert.rejects(signedFileBatch(missing.client,'owner',refs),error=>error.status===410);
});
