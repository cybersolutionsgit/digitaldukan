import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {themes,themeForNiche} from '../public/themes.js';
const dir=mkdtempSync(join(tmpdir(),'dukan-themes-')),base='http://127.0.0.1:3484';let child;
before(async()=>{child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3484',DATA_DIR:dir,NODE_ENV:'test',AUTO_BACKUPS:'false'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server failed'))})});});
after(async()=>{if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()});rmSync(dir,{recursive:true,force:true})});
async function req(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
test('niche recommendations handle category, a more specific niche and unknown businesses',()=>{
 assert.equal(themeForNiche('Electronics',''),'electronics');
 assert.equal(themeForNiche('Other','skincare'),'beauty');
 assert.equal(themeForNiche('Other','bakery'),'food');
 assert.equal(themeForNiche('Other','women clothing'),'fashion');
 assert.equal(themeForNiche('Other','handmade gifts'),'handmade');
 assert.equal(themeForNiche('Other','book repair service'),'other');
});
test('signup derives a free preset, preserves explicit choices and persists themes safely',async()=>{
 const body={email:'theme@example.com',password:'Theme-test-password-123',slug:'theme-shop',subscribed:true,details:{name:'Theme Shop',category:'Other',niche:'skincare',whatsapp:'923001234567',delivery:200,accent:'#123456'},sections:[{type:'hero',layout:3},{type:'contact',layout:1}]};
 let r=await req('/api/signup','POST',body);assert.equal(r.status,200);const cookie=r.cookie;
 r=await req('/api/session','GET',undefined,cookie);const store=r.data.store;
 assert.equal(store.details.theme,'beauty');assert.equal(store.details.niche,'skincare');assert.equal(store.details.accent,'#123456');assert.equal(store.sections[0].layout,3);
 r=await req('/api/store','PATCH',{details:{...store.details,theme:'electronics'},sections:store.sections},cookie);assert.equal(r.status,200);
 r=await req('/api/public/theme-shop','GET',undefined,cookie);assert.equal(r.data.store.details.theme,'electronics');assert.equal(r.data.store.details.accent,'#123456');
 r=await req('/api/store','PATCH',{details:{...store.details,theme:'malicious-css'},sections:store.sections},cookie);assert.equal(r.status,400);
 r=await req('/api/store','PATCH',{details:{...store.details,niche:'x'.repeat(201)},sections:store.sections},cookie);assert.equal(r.status,400);
 const oldDetails={...store.details};delete oldDetails.theme;delete oldDetails.niche;
 r=await req('/api/store','PATCH',{details:oldDetails,sections:store.sections},cookie);assert.equal(r.status,200);
 r=await req('/api/session','GET',undefined,cookie);assert.equal(r.data.store.details.theme,'classic','updates to legacy details keep classic styling');
});
test('theme module is served locally and a new niche receives its palette when no color was chosen',async()=>{
 const r=await req('/api/signup','POST',{email:'food-theme@example.com',password:'Theme-test-password-123',slug:'food-theme',subscribed:true,details:{name:'Pantry',category:'Food & groceries',whatsapp:'923001234567',delivery:200},sections:[{type:'hero',layout:1}]});assert.equal(r.status,200);
 const session=await req('/api/session','GET',undefined,r.cookie);assert.equal(session.data.store.details.accent,themes.food.accent);
 const script=await fetch(base+'/themes.js');assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);
});
