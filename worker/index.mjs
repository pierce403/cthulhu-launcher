import {commit} from './version.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const aiUnavailable=()=>json({message:'The legacy OpenAI assistant is unavailable. Its integration needs repair.'},503);
const MAX_BODY=10*1024*1024;
async function boundedBody(request){
 if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw new Error('body_too_large');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw new Error('body_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function payload(request){
 const bytes=await boundedBody(request);
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
async function provider(env,path,options={}){
 if(env.STAGING==='true'){
  if(path==='/files'&&options.method==='POST')return {id:'file_fixture_'+crypto.randomUUID()};
  if(path.startsWith('/files/')&&options.method==='DELETE')return {deleted:true};
  if(path==='/chat/completions')return {choices:[{message:{content:'75'}}]};
  throw new Error('unexpected_fixture_provider_call');
 }
 if(!env.OPENAI_API_KEY)throw new Error('provider_unconfigured');
 const response=await fetch('https://api.openai.com/v1'+path,{...options,headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,...options.headers},signal:AbortSignal.timeout(30000)});
 if(!response.ok){await response.body?.cancel();throw new Error('provider_request_failed');}
 return response.json();
}
function filename(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\\/]/g,' ').trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_.-]/g,'').replace(/^[._]+|[._]+$/g,'');}
async function upload(request,env){
 const bytes=await boundedBody(request);let form;
 try{form=await new Request(request.url,{method:'POST',headers:request.headers,body:bytes}).formData();}catch{return json({error:'No file part'},400);}
 const file=form.get('file');if(!(file instanceof File))return json({error:'No file part'},400);
 if(!file.name)return json({error:'No selected file'},400);
 const userId=form.get('user_id');if(!userId||typeof userId!=='string')return json({error:'User ID is required'},400);
 if(!await env.DB.prepare('SELECT id FROM "user" WHERE user_id=?').bind(userId).first())return json({error:'Unable to store file for this user'},500);
 if(env.STAGING!=='true'&&!env.OPENAI_API_KEY)return json({error:'File processing is temporarily unavailable'},503);
 const name=filename(file.name),key='files/'+crypto.randomUUID();let remoteId,stored=false;
 try{
  const providerForm=new FormData();providerForm.set('purpose','assistants');providerForm.set('file',file,name);
  const remote=await provider(env,'/files',{method:'POST',body:providerForm});remoteId=remote.id;if(typeof remoteId!=='string')throw new Error('invalid_provider_file');
  let score=0;
  try{
   const content=new TextDecoder().decode(await file.arrayBuffer()).replace(/\uFFFD/g,'');
   const result=await provider(env,'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-3.5-turbo',messages:[{role:'system',content:'You are an AI assistant tasked with evaluating the relevance of a document to a "dark agenda". Score the document from 0 to 100, where 100 is extremely relevant. Respond with only the numeric score.'},{role:'user',content:'Evaluate this document:\n\n'+content}]})});
   const match=result.choices?.[0]?.message?.content?.match(/\d+/);score=match?Math.max(0,Math.min(Number(match[0]),100)):0;
  }catch{console.warn('Cthulhu file scoring unavailable');}
  await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});stored=true;
  await env.DB.prepare('INSERT INTO file(user_id,filename,file_key,upload_date,mime_type,file_size,score,openai_file_id) VALUES(?,?,?,?,?,?,?,?)').bind(userId,name,key,new Date().toISOString().replace('T',' ').replace('Z',''),file.type||'application/octet-stream',file.size,score,remoteId).run();
  return json({message:'File uploaded successfully',filename:name,openai_file_id:remoteId,score});
 }catch{
  if(stored)await env.FILES.delete(key).catch(()=>console.error('Cthulhu upload compensation failed'));
  if(remoteId)await provider(env,'/files/'+encodeURIComponent(remoteId),{method:'DELETE'}).catch(()=>console.error('Cthulhu provider compensation failed'));
  return json({error:'Unable to upload this file'},500);
 }
}
const worker={
 async fetch(request,env){
  if(request.method==='HEAD'){
   const response=await worker.fetch(new Request(request,{method:'GET'}),env);
   await response.body?.cancel();return new Response(null,{status:response.status,headers:response.headers});
  }
  const url=new URL(request.url),path=url.pathname;
  if(url.protocol!=='https:'){url.protocol='https:';return Response.redirect(url.toString(),308);}
  if(env.READ_ONLY==='true'&&!['GET','HEAD'].includes(request.method))return json({error:'The site is temporarily read-only during migration.'},503);
  if(path==='/deployment.json')return json({repository:'pierce403/cthulhu-launcher',commit,originalHerokuCommit:'e1dd5f0b2b9fd7be04a9aa70f3a2a6798e8b55ac'});
  try{
   if(path==='/getwork'&&request.method==='GET')return json({task_id:crypto.randomUUID(),description:'Analyze and optimize the given code snippet',code_blob:'def example_function():\n    # TODO: Implement this function\n    pass'});
   if(path==='/submit'&&request.method==='POST'){
    const data=await payload(request);if(!data||!Object.keys(data).length)return json({error:'No data provided'},400);
    if(!Object.hasOwn(data,'task_id')||!Object.hasOwn(data,'result'))return json({error:'Missing required fields'},400);
    return json({status:'success',message:'Work submitted successfully',task_id:data.task_id});
   }
   if(path==='/api/chat'&&request.method==='POST'){
    const data=await payload(request);
    if(!data||typeof data!=='object'||Array.isArray(data))return json({message:'Invalid request format. Please provide a valid JSON object.'},400);
    if(typeof data.message!=='string'||!data.message)return json({message:'Invalid or missing message. Please provide a non-empty string.'},400);
    if(typeof data.user_id!=='string'||!data.user_id)return json({message:'Invalid or missing user_id. Please provide a non-empty string.'},400);
    if(data.conversation_id&&typeof data.conversation_id!=='string')return json({message:'Invalid conversation_id. Please provide a string or omit it.'},400);
    // Original fixed assistant returns404, and Assistants has been retired.
    // Retain existing conversation data; do not fabricate or store AI replies.
    return aiUnavailable();
   }
   if(['/create_tsathoth','/create_hasturogtha'].includes(path)&&request.method==='POST'){
    const id=path==='/create_tsathoth'?'Tsathoth':'Hasturogtha';
    await env.DB.prepare('INSERT INTO "user"(user_id,user_score,user_notes) VALUES(?,0,\'\') ON CONFLICT(user_id) DO NOTHING').bind(id).run();
    return json({message:`${id} user created or already exists.`});
   }
   if(path==='/upload'&&request.method==='POST')return await upload(request,env);
   const scorePath=/^\/get_file_score\/(\d+)$/.exec(path);
   if(scorePath&&request.method==='GET'){
    const id=Number(scorePath[1]);const file=await env.DB.prepare('SELECT id,score FROM file WHERE id=?').bind(id).first();
    return file?json({file_id:file.id,score:file.score}):json({error:'File not found'},404);
   }
   if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
   const response=await env.ASSETS.fetch(request);
   if(path==='/'){
    const notice=env.READ_ONLY==='true'?'<p role="status">The site is temporarily read-only during migration.</p>':'';
    if(notice)return new HTMLRewriter().on('body',{element(e){e.prepend(notice,{html:true})}}).transform(response);
   }
   return response;
  }catch(error){console.error('Cthulhu request failed');return json({error:error.message==='body_too_large'?'Request too large':'Unable to process this request'},error.message==='body_too_large'?413:500);}
 },
};
export default worker;
