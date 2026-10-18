import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {businessDetails} from './fixtures.js';
import {usernameIssue,normalizeSocialLink} from '../public/validation.js';

const base='http://127.0.0.1:3495',password='Step-validation-password-123';
test('early checks match final signup rules and product photos are enforced on create and edit',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dukan-step-validation-'));let server;
 async function request(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const signup={email:'taken@example.com',password,slug:'taken-store',subscribed:true,details:{...businessDetails,name:'Sample shop',whatsapp:'923001234567',delivery:100},sections:[{type:'hero',layout:1}]};
 try{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3495',DATA_DIR:dir,NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'false',AUTO_BACKUPS:'false'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve()});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  let r=await request('/api/signup','POST',signup);assert.equal(r.status,200);const owner=r.cookie;
  r=await request('/api/signup/check','POST',{email:signup.email});assert.equal(r.data.ok,false);assert.match(r.data.errors.email,/already/);
  r=await request('/api/signup/check','POST',{slug:signup.slug});assert.equal(r.data.ok,false);assert.match(r.data.errors.slug,/taken/);
  r=await request('/api/signup/check','POST',{email:'free@example.com',slug:'nayastore'});assert.equal(r.status,200);assert.equal(r.data.ok,true);
  for(const slug of ['bad name','a_b_c','-shop','shop-','abc','a'.repeat(41),'admin','templates']){r=await request('/api/signup/check','POST',{slug});assert.equal(r.data.errors.slug,usernameIssue(slug));assert.ok(r.data.errors.slug);}
  r=await request('/api/signup/check','POST',{email:'missing-at-sign'});assert.ok(r.data.errors.email);
  for(const raw of ['javascript:alert(1)','bad link','instagram','https://user:pass@example.com']){
   assert.throws(()=>normalizeSocialLink(raw));r=await request('/api/signup','POST',{...signup,email:'other@example.com',slug:'other-store',details:{...signup.details,instagram:raw}});assert.equal(r.status,400);
  }
  r=await request('/api/products','POST',{name:'Cake',price:100,images:[]},owner);assert.equal(r.status,400);assert.equal(r.data.error,'Add at least one product photo.');
  r=await request('/api/products','POST',{name:'Cake',price:100,images:['/stock/product-cake.webp']},owner);assert.equal(r.status,200);
  r=await request('/api/products','GET',undefined,owner);const product=r.data[0];
  r=await request('/api/products','POST',{...product.details,id:product.id,images:[]},owner);assert.equal(r.status,400);
  r=await request('/api/products','GET',undefined,owner);assert.deepEqual(r.data[0].details.images,['/stock/product-cake.webp']);
  r=await request('/api/signup/check','POST',{slug:'free-before-race'});assert.equal(r.data.ok,true);
  r=await request('/api/signup','POST',{...signup,email:'race-one@example.com',slug:'free-before-race'});assert.equal(r.status,200);
  r=await request('/api/signup','POST',{...signup,email:'race-two@example.com',slug:'free-before-race'});assert.equal(r.status,400,'final signup still protects against a username taken after its early check');
 }finally{if(server?.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill()});rmSync(dir,{recursive:true,force:true})}
});
