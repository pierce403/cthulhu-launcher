import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {Wallet,verifyMessage} from 'ethers';
test('frontend wallet signatures preserve the XMTP EOA message format',async()=>{
 const signer=new Wallet('0x'+'11'.repeat(32)),message='Isolated migration signature';
 const bytes=Uint8Array.from(Buffer.from((await signer.signMessage(message)).slice(2),'hex'));
 assert.equal(verifyMessage(message,'0x'+Buffer.from(bytes).toString('hex')),signer.address);
});
test('actual Worker preserves routes, D1 constraints, private files, mocked upload and frozen state',async()=>{
 execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--env','','--outdir','build/worker'],{stdio:'pipe'});
 const base={name:'cthulhu-test',modules:true,scriptPath:'build/worker/index.js',compatibilityDate:'2026-10-13',bindings:{STAGING:'true',READ_ONLY:'false'},d1Databases:{DB:'synthetic-cthulhu'},r2Buckets:{FILES:'synthetic-files'},assets:{directory:'frontend/dist',binding:'ASSETS',run_worker_first:true},outboundService:()=>{throw new Error('No external provider or XMTP network allowed in fixture');}};
 const convert=options=>{const value=convertV4MiniflareOptions(options);value.workers[0].config.assets.hasUserWorker=true;return value;};
 const mf=new Miniflare(convert(base));
 try{
  let db=await mf.getD1Database('DB');for(const sql of fs.readFileSync('migrations/0001_d1.sql','utf8').split(';').filter(x=>x.trim()))await db.prepare(sql).run();
  let r=await mf.dispatchFetch('https://cthulhu.test/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/CTHULHU.BOT/);assert.doesNotMatch(html,/%PUBLIC_URL%/);
  r=await mf.dispatchFetch('https://cthulhu.test/missing');assert.equal(r.status,404);await r.text();
  r=await mf.dispatchFetch('http://cthulhu.test/getwork?q=1',{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://cthulhu.test/getwork?q=1');await r.text();
  r=await mf.dispatchFetch('https://cthulhu.test/getwork');const work=await r.json();assert.match(work.task_id,/^[0-9a-f-]{36}$/);assert.equal(work.description,'Analyze and optimize the given code snippet');
  r=await mf.dispatchFetch('https://cthulhu.test/getwork',{method:'HEAD'});assert.equal(r.status,200);assert.equal((await r.text()).length,0);
  const post=(path,data)=>mf.dispatchFetch('https://cthulhu.test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  r=await post('/submit',{});assert.equal(r.status,400);assert.equal((await r.json()).error,'No data provided');
  r=await post('/submit',{task_id:'fixture'});assert.equal(r.status,400);await r.json();r=await post('/submit',{task_id:'fixture',result:'synthetic'});assert.equal((await r.json()).status,'success');
  r=await post('/api/chat',{message:'test'});assert.equal(r.status,400);await r.json();r=await post('/api/chat',{message:'test',user_id:'fixture'});assert.equal(r.status,503);await r.json();assert.equal((await db.prepare('SELECT COUNT(*) n FROM "user"').first()).n,0);
  const creates=await Promise.all(Array.from({length:4},async()=>{const response=await post('/create_tsathoth',{});assert.equal(response.status,200);await response.json();}));
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM "user"').first()).n,1);
  await assert.rejects(db.batch([db.prepare('INSERT INTO "user"(user_id) VALUES(?)').bind('rollback-fixture'),db.prepare('INSERT INTO message(conversation_id,content) VALUES(?,?)').bind('missing','fixture')]));assert.equal(await db.prepare('SELECT id FROM "user" WHERE user_id=?').bind('rollback-fixture').first(),null);
  const form=new FormData();const bytes=Uint8Array.from({length:228241},(_,i)=>i%256);form.set('user_id','Tsathoth');form.set('file',new File([bytes],'../../fixture.pdf',{type:'application/pdf'}));
  const multipart=new Request('https://cthulhu.test/upload',{method:'POST',body:form});
  r=await mf.dispatchFetch(multipart.url,{method:'POST',headers:Object.fromEntries(multipart.headers),body:await multipart.arrayBuffer()});assert.equal(r.status,200,await r.clone().text());const uploaded=await r.json();assert.equal(uploaded.filename,'fixture.pdf');assert.equal(uploaded.score,75);
  const metadata=await db.prepare('SELECT * FROM file').first();assert.equal(metadata.file_size,bytes.length);assert.equal(metadata.user_id,'Tsathoth');const bucket=await mf.getR2Bucket('FILES');const object=await bucket.get(metadata.file_key);assert.deepEqual(new Uint8Array(await object.arrayBuffer()),bytes);assert.equal(object.httpMetadata.contentType,'application/pdf');
  r=await mf.dispatchFetch('https://cthulhu.test/get_file_score/'+metadata.id);assert.deepEqual(await r.json(),{file_id:metadata.id,score:75});r=await mf.dispatchFetch('https://cthulhu.test/'+metadata.file_key);assert.equal(r.status,404);await r.text();
  r=await mf.dispatchFetch('https://cthulhu.test/get_file_score/999');assert.equal(r.status,404);await r.json();
  const snapshot=async()=>JSON.stringify((await db.prepare('SELECT * FROM "user" ORDER BY id').all()).results);const before=await snapshot();
  await mf.setOptions(convert({...base,bindings:{...base.bindings,READ_ONLY:'true'}}));db=await mf.getD1Database('DB');
  for(const path of ['/api/chat','/submit','/upload','/create_hasturogtha']){r=await post(path,{});assert.equal(r.status,503);await r.json();}
  assert.equal(await snapshot(),before);r=await mf.dispatchFetch('https://cthulhu.test/');assert.match(await r.text(),/temporarily read-only/);
  const wasm=fs.readdirSync('frontend/dist/assets').find(n=>n.endsWith('.wasm'));r=await mf.dispatchFetch('https://cthulhu.test/assets/'+wasm);assert.equal(r.headers.get('content-type'),'application/wasm');assert.deepEqual(Buffer.from(await r.arrayBuffer()),fs.readFileSync('frontend/dist/assets/'+wasm));
 }finally{await mf.dispose();}
});
