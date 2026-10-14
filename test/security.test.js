import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { restoreBackup } from '../backups.js';
const exec=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'dukan-security-')),base='http://127.0.0.1:3482';
const password='Security-test-password-123';let child,ownerCookie,adminCookie,ownerId,storeId;
async function start(){
 child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3482',DATA_DIR:dir,NODE_ENV:'test',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',BACKUP_KEEP:'invalid',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve()});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
}
async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
before(start);after(async()=>{await stop();rmSync(dir,{recursive:true,force:true})});
async function request(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
function mail(to,kind){return readdirSync(join(dir,'test-outbox')).map(n=>({name:n,...JSON.parse(readFileSync(join(dir,'test-outbox',n),'utf8'))})).filter(m=>m.to===to&&m.kind===kind).sort((a,b)=>b.name.localeCompare(a.name))[0]}
function tokenFor(message){return new URLSearchParams(new URL(message.url).hash.slice(1)).get('token')}
function database(fn){const db=new DatabaseSync(join(dir,'digitaldukan.sqlite'));try{return fn(db)}finally{db.close()}}
function clearRates(){database(db=>db.exec('DELETE FROM rate_limits'))}

test('verification gates approval and uses expiring, single-use, hashed tokens',async()=>{
 let r=await request('/api/signup','POST',{email:'owner@example.com',password,slug:'secure-shop',subscribed:true,details:{name:'Secure Shop',whatsapp:'923001234567',delivery:200},sections:[{type:'hero',layout:1}]});assert.equal(r.status,200);assert.equal(r.data.verificationEmailSent,true);ownerCookie=r.cookie;
 r=await request('/api/session','GET',undefined,ownerCookie);ownerId=r.data.user.id;storeId=r.data.store.id;assert.equal(r.data.user.emailVerified,false);
 r=await request('/api/login','POST',{email:'admin@example.com',password});adminCookie=r.cookie;
 r=await request('/api/admin/stores/'+storeId,'PATCH',{status:'approved'},adminCookie);assert.equal(r.status,400);
 const first=tokenFor(mail('owner@example.com','verify'));
 assert.equal(database(db=>db.prepare('SELECT token FROM auth_tokens WHERE user_id=?').get(ownerId).token),createHash('sha256').update(first).digest('hex'));
 database(db=>db.prepare('UPDATE auth_tokens SET expires=? WHERE user_id=?').run(Date.now()-1,ownerId));
 r=await request('/api/auth/verify-email','POST',{token:first});assert.equal(r.status,400);
 r=await request('/api/auth/resend-verification','POST',{},ownerCookie);assert.equal(r.status,200);
 const token=tokenFor(mail('owner@example.com','verify'));
 assert.notEqual(token,first);
 r=await request('/api/auth/reset-password','POST',{token,password:'Must-not-be-applied'});assert.equal(r.status,400);
 r=await request('/api/auth/verify-email','POST',{token});assert.equal(r.status,200);
 r=await request('/api/auth/verify-email','POST',{token});assert.equal(r.status,400);
 r=await request('/api/session','GET',undefined,ownerCookie);assert.equal(r.data.user.emailVerified,true);
 r=await request('/api/admin/stores/'+storeId,'PATCH',{status:'approved'},adminCookie);assert.equal(r.status,200);
});

test('password reset hides unknown accounts and revokes every existing owner session',async()=>{
 let r=await request('/api/login','POST',{email:'owner@example.com',password});const secondCookie=r.cookie;
 const existing=await request('/api/auth/forgot-password','POST',{email:'owner@example.com'});
 const unknown=await request('/api/auth/forgot-password','POST',{email:'unknown@example.com'});
 assert.equal(existing.status,200);assert.deepEqual(existing.data,unknown.data);
 assert.equal(mail('unknown@example.com','reset'),undefined);
 const token=tokenFor(mail('owner@example.com','reset'));
 assert.equal(database(db=>db.prepare('SELECT token FROM auth_tokens WHERE user_id=? AND kind=?').get(ownerId,'reset').token),createHash('sha256').update(token).digest('hex'));
 r=await request('/api/auth/reset-password','POST',{token,password:'short'});assert.equal(r.status,400);
 r=await request('/api/auth/reset-password','POST',{token,password:'New-owner-password-456'});assert.equal(r.status,200);
 r=await request('/api/orders','GET',undefined,ownerCookie);assert.equal(r.status,401);
 r=await request('/api/orders','GET',undefined,secondCookie);assert.equal(r.status,401);
 r=await request('/api/auth/reset-password','POST',{token,password:'Another-password'});assert.equal(r.status,400);
 r=await request('/api/login','POST',{email:'owner@example.com',password});assert.equal(r.status,401);
 r=await request('/api/login','POST',{email:'owner@example.com',password:'New-owner-password-456'});assert.equal(r.status,200);ownerCookie=r.cookie;
});

test('admin reset survives restart instead of reverting to the bootstrap password',async()=>{
 let r=await request('/api/auth/forgot-password','POST',{email:'admin@example.com'});assert.equal(r.status,200);
 const token=tokenFor(mail('admin@example.com','reset'));
 r=await request('/api/auth/reset-password','POST',{token,password:'New-admin-password-456'});assert.equal(r.status,200);
 await stop();await start();
 r=await request('/api/login','POST',{email:'admin@example.com',password});assert.equal(r.status,401);
 r=await request('/api/login','POST',{email:'admin@example.com',password:'New-admin-password-456'});assert.equal(r.status,200);adminCookie=r.cookie;
});

test('backups are admin-only, include photos, restore records and invalidate sessions',async()=>{
 let r=await request('/api/admin/backups','GET',undefined,ownerCookie);assert.equal(r.status,403);
 r=await request('/api/admin/backups','POST',{},ownerCookie);assert.equal(r.status,403);
 const photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNmcAAAAASUVORK5CYII=';
 r=await request('/api/upload','POST',{type:'image/png',data:photo},ownerCookie);assert.equal(r.status,200);const image=r.data.url;
 r=await request('/api/products','POST',{name:'Backed-up product',price:1200,images:[image],stock:''},ownerCookie);assert.equal(r.status,200);
 r=await request('/api/admin/backups','POST',{},adminCookie);assert.equal(r.status,200);const name=r.data.backup.name;const backupList=await request('/api/admin/backups','GET',undefined,adminCookie);assert.equal(backupList.data.keep,3);assert.equal(backupList.data.items.length,1);
 let download=await fetch(base+'/api/admin/backups/'+name);assert.equal(download.status,401);
 download=await fetch(base+'/api/admin/backups/'+name,{headers:{cookie:ownerCookie}});assert.equal(download.status,403);
 download=await fetch(base+'/api/admin/backups/'+name,{headers:{cookie:adminCookie}});assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/gzip');
 const downloaded=join(dir,'downloaded.tar.gz');writeFileSync(downloaded,Buffer.from(await download.arrayBuffer()));
 const destination=join(dir,'restore-check');await restoreBackup(downloaded,destination);
 const restored=new DatabaseSync(join(destination,'digitaldukan.sqlite'));
 assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM products').get().n,1);
 assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM users').get().n,2);
 assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
 assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM auth_tokens').get().n,0);restored.close();
 assert.equal(readFileSync(join(destination,image.slice(1))).toString('base64'),photo);
 await assert.rejects(restoreBackup(downloaded,destination),/empty destination/);
 const publicData=await fetch(base+'/data/digitaldukan.sqlite');assert.match(publicData.headers.get('content-type'),/text\/html/);assert.ok(!(await publicData.text()).includes('SQLite format')); // Private data is never served as an asset.
});

test('malformed bodies, cross-site writes and tampered backup files are rejected',async()=>{
 let r=await fetch(base+'/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'});assert.equal(r.status,400);
 r=await fetch(base+'/api/logout',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site',cookie:ownerCookie},body:'{}'});assert.equal(r.status,403);
 const listing=await request('/api/admin/backups','GET',undefined,adminCookie);const archive=join(dir,'backups',listing.data.items[0].name);
 const stage=join(dir,'tamper');mkdirSync(stage);
 await exec('tar',['-xzf',archive,'-C',stage]);
 const dbfile=join(stage,'digitaldukan.sqlite');const contents=readFileSync(dbfile);contents[0]=0;writeFileSync(dbfile,contents);
 const tampered=join(dir,'tampered.tar.gz');await exec('tar',['-czf',tampered,'-C',stage,'manifest.json','digitaldukan.sqlite','uploads']);
 await assert.rejects(restoreBackup(tampered,join(dir,'tamper-restore')),/checksum/);
 const headers=await fetch(base+'/');assert.equal(headers.headers.get('x-frame-options'),'DENY');assert.equal(headers.headers.get('referrer-policy'),'no-referrer');
});

test('login throttling survives restart and cannot be bypassed using a forged forwarded IP',async()=>{
 clearRates();for(let i=0;i<15;i++){const r=await request('/api/login','POST',{email:'locked@example.com',password:'Wrong-password'});assert.equal(r.status,401)}
 await stop();await start();
 const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'1.2.3.4'},body:JSON.stringify({email:'locked@example.com',password:'Wrong-password'})});assert.equal(r.status,429);
});


test('one store owner cannot alter another store, products or orders',async()=>{
 clearRates();
 let r=await request('/api/signup','POST',{email:'other@example.com',password,slug:'other-shop',subscribed:true,details:{name:'Other Shop',whatsapp:'923001234567',delivery:200},sections:[{type:'featured',layout:1}]});assert.equal(r.status,200);const other=r.cookie;
 const rows=await request('/api/products','GET',undefined,ownerCookie);const product=rows.data[0];
 r=await request('/api/products','POST',{...product.details,id:product.id,name:'Unauthorized edit'},other);assert.equal(r.status,404);
 r=await request('/api/products/'+product.id,'DELETE',{},other);assert.equal(r.status,200);
 r=await request('/api/products','GET',undefined,ownerCookie);assert.equal(r.data[0].details.name,'Backed-up product');
 r=await request('/api/admin/stores/'+storeId,'PATCH',{status:'suspended',reason:'Unauthorized'},other);assert.equal(r.status,403);
 r=await request('/api/products','POST',{name:{bad:true},price:1,images:[]},other);assert.equal(r.status,400);
 r=await request('/api/checkout','POST',{slug:'secure-shop',name:'Customer',phone:'03001234567',address:'Lahore',items:[null]});assert.equal(r.status,400);
});
