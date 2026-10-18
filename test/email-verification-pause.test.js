import {businessDetails} from './fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const base='http://127.0.0.1:3487',password='Pause-test-password-1234';
test('pausing verification preserves records, password reset and manual approval; re-enabling restores verification',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dukan-verification-pause-'));let child;
 async function start(enabled){
  const env={...process.env,PORT:'3487',DATA_DIR:dir,NODE_ENV:'test',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password};
  delete env.EMAIL_VERIFICATION_ENABLED; // Exercise the shipped paused default, irrespective of the parent environment.
  if(enabled!==undefined)env.EMAIL_VERIFICATION_ENABLED=String(enabled);
  child=spawn(process.execPath,['server.js'],{env,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
 }
 async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
 async function request(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const messages=()=>existsSync(join(dir,'test-outbox'))?readdirSync(join(dir,'test-outbox')).map(n=>JSON.parse(readFileSync(join(dir,'test-outbox',n),'utf8'))):[];
 const token=mail=>new URLSearchParams(new URL(mail.url).hash.slice(1)).get('token');
 const signup=(email,slug)=>request('/api/signup','POST',{email,password,slug,subscribed:true,details:{...businessDetails,name:'Pause Shop',whatsapp:'923001234567',delivery:0},sections:[{type:'hero',layout:1}]});
 try{
  await start();
  let r=await signup('owner@example.com','pause-shop');assert.equal(r.status,200);assert.equal(r.data.verificationEmailSent,false);let owner=r.cookie;
  r=await request('/api/session','GET',undefined,owner);assert.equal(r.data.verificationEnabled,false);assert.equal(r.data.user.emailVerified,false);const storeId=r.data.store.id;
  assert.equal(messages().length,0);
  r=await request('/api/public/pause-shop');assert.equal(r.status,403,'manual approval still required');
  r=await request('/api/auth/resend-verification','POST',{},owner);assert.equal(r.status,503);assert.match(r.data.error,/temporarily paused/);
  r=await request('/api/auth/verify-email','POST',{token:'a'.repeat(64)});assert.equal(r.status,503);
  r=await request('/api/login','POST',{email:'admin@example.com',password});const admin=r.cookie;
  r=await request('/api/admin/stores/'+storeId,'PATCH',{status:'approved'},admin);assert.equal(r.status,200);
  r=await request('/api/public/pause-shop');assert.equal(r.status,200);
  assert.equal((await request('/api/products','POST',{name:'Sample product',price:100,images:['/stock/product-cake.webp']},owner)).status,200);
  r=await request('/api/store/launch-check','POST',{confirmed:true},owner);assert.equal(r.status,200);const checkedAt=r.data.completedAt;
  r=await request('/api/admin/stores/'+storeId+'/account','POST',{email:'changed@example.com',adminPassword:password},admin);assert.equal(r.status,200);assert.equal(r.data.verificationEmailSent,false);assert.equal(messages().length,0);
  r=await request('/api/login','POST',{email:'changed@example.com',password});owner=r.cookie;
  r=await request('/api/session','GET',undefined,owner);assert.equal(r.data.user.emailVerified,false);
  r=await request('/api/auth/forgot-password','POST',{email:'changed@example.com'});assert.equal(r.status,200);
  for(let i=0;i<50&&!messages().some(m=>m.kind==='reset');i++)await new Promise(resolve=>setTimeout(resolve,20));
  const reset=messages().find(m=>m.kind==='reset');assert.ok(reset);assert.equal(messages().some(m=>m.kind==='verify'),false);
  r=await request('/api/auth/reset-password','POST',{token:token(reset),password:'Changed-owner-password-123'});assert.equal(r.status,200);
  r=await request('/api/login','POST',{email:'changed@example.com',password:'Changed-owner-password-123'});assert.equal(r.status,200);
  r=await signup('pending@example.com','pending-shop');const pending=r.cookie;
  r=await request('/api/session','GET',undefined,pending);const pendingId=r.data.store.id;
  await stop();await start(true);
  r=await request('/api/session','GET',undefined,pending);assert.equal(r.data.verificationEnabled,true);assert.equal(r.data.user.emailVerified,false);
  r=await request('/api/public/pause-shop');assert.equal(r.status,200,'approved stores stay public after re-enabling');
  const returningOwner=(await request('/api/login','POST',{email:'changed@example.com',password:'Changed-owner-password-123'})).cookie;
  assert.equal((await request('/api/session','GET',undefined,returningOwner)).data.store.launch_checked_at,checkedAt,'completion survives a server restart');
  assert.equal((await request('/api/store/launch-check','POST',{confirmed:true},returningOwner)).status,409,'enabled verification cannot be bypassed by checklist completion');
  r=await request('/api/admin/stores/'+pendingId,'PATCH',{status:'approved'},admin);assert.equal(r.status,400);
  r=await request('/api/auth/resend-verification','POST',{},pending);assert.equal(r.status,200);
  const verification=messages().find(m=>m.kind==='verify'&&m.to==='pending@example.com');assert.ok(verification);
  await stop();await start(false);
  r=await request('/api/auth/verify-email','POST',{token:token(verification)});assert.equal(r.status,503,'old links cannot change verification state while paused');
  r=await request('/api/session','GET',undefined,pending);assert.equal(r.data.user.emailVerified,false);
  await stop();await start(true);
  r=await request('/api/auth/verify-email','POST',{token:token(verification)});assert.equal(r.status,200,'valid tokens are preserved for re-enabling');
  r=await request('/api/session','GET',undefined,pending);assert.equal(r.data.user.emailVerified,true);
  r=await request('/api/admin/stores/'+pendingId,'PATCH',{status:'approved'},admin);assert.equal(r.status,200);
 }finally{await stop();rmSync(dir,{recursive:true,force:true})}
});
