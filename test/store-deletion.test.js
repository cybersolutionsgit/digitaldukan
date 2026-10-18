import {businessDetails} from './fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const base='http://127.0.0.1:3489',password='Delete-test-password-123';
test('admin store deletion requires reauthentication and exact confirmation, is atomic and isolated, and revokes the owner account',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dukan-delete-'));let server;
 async function request(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 function database(fn){const db=new DatabaseSync(join(dir,'digitaldukan.sqlite'));try{return fn(db)}finally{db.close()}}
 const signup=(email,slug)=>request('/api/signup','POST',{email,password,slug,subscribed:true,details:{...businessDetails,name:slug,whatsapp:'923001234567',delivery:0},sections:[{type:'hero',layout:1}]});
 const image={type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNmcAAAAASUVORK5CYII='};
 try{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3489',DATA_DIR:dir,NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'false',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve()});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  let r=await signup('delete@example.com','delete-shop');assert.equal(r.status,200);const owner=r.cookie;
  r=await request('/api/session','GET',undefined,owner);const store=r.data.store,ownerId=r.data.user.id;
  r=await signup('keep@example.com','keep-shop');const otherOwner=r.cookie;
  r=await request('/api/session','GET',undefined,otherOwner);const otherStore=r.data.store;
  r=await request('/api/upload','POST',image,owner);const privateImage=r.data.url;
  r=await request('/api/upload','POST',image,owner);const sharedImage=r.data.url;
  r=await request('/api/upload','POST',image,otherOwner);const otherImage=r.data.url;
  r=await request('/api/store','PATCH',{details:{...businessDetails,...otherStore.details,logo:sharedImage,banner:otherImage},sections:otherStore.sections},otherOwner);assert.equal(r.status,200);
  r=await request('/api/products','POST',{name:'Delete product',price:1200,images:[privateImage]},owner);assert.equal(r.status,200);
  r=await request('/api/products','GET',undefined,owner);const productId=r.data[0].id;
  r=await request('/api/products','POST',{name:'Keep product',price:1800,images:[otherImage]},otherOwner);assert.equal(r.status,200);
  r=await request('/api/login','POST',{email:'admin@example.com',password});const admin=r.cookie;
  r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'approved'},admin);assert.equal(r.status,200);
  r=await request('/api/checkout','POST',{slug:store.slug,name:'Test customer',phone:'03001234567',address:'Test address',items:[{id:productId,quantity:1}]});assert.equal(r.status,200);
  database(db=>{db.prepare('INSERT INTO auth_tokens VALUES(?,?,?,?)').run('a'.repeat(64),ownerId,'reset',Date.now()+10000);db.prepare('INSERT INTO account_audit VALUES(?,?,?,?,?)').run('test-audit',db.prepare("SELECT id FROM users WHERE role='admin'").get().id,ownerId,'password_reset',new Date().toISOString())});
  const route='/api/admin/stores/'+store.id,confirmation={confirmSlug:store.slug,adminPassword:password};
  for(const [cookie,body,status]of [[undefined,confirmation,401],[owner,confirmation,403],[otherOwner,confirmation,403],[admin,{...confirmation,adminPassword:'wrong-password'},403],[admin,{...confirmation,confirmSlug:'keep-shop'},400]]){
   r=await request(route,'DELETE',body,cookie);assert.equal(r.status,status);
  }
  r=await request('/api/public/delete-shop');assert.equal(r.status,200);
  database(db=>db.exec("CREATE TRIGGER prevent_test_delete BEFORE DELETE ON users WHEN OLD.role='owner' BEGIN SELECT RAISE(ABORT,'test rollback'); END"));
  r=await request(route,'DELETE',confirmation,admin);assert.equal(r.status,500);
  r=await request('/api/session','GET',undefined,owner);assert.equal(r.data.user.id,ownerId);
  r=await request('/api/products','GET',undefined,owner);assert.equal(r.data.length,1);
  r=await request('/api/orders','GET',undefined,owner);assert.equal(r.data.length,1);
  assert.equal((await fetch(base+privateImage)).status,200);
  database(db=>db.exec('DROP TRIGGER prevent_test_delete'));
  r=await request(route,'DELETE',confirmation,admin);assert.equal(r.status,200);
  r=await request('/api/public/delete-shop');assert.equal(r.status,404);
  r=await request('/api/session','GET',undefined,owner);assert.equal(r.data.user,null);
  r=await request('/api/login','POST',{email:'delete@example.com',password});assert.equal(r.status,401);
  assert.equal((await fetch(base+privateImage)).status,404);assert.equal((await fetch(base+sharedImage)).status,200);assert.equal((await fetch(base+otherImage)).status,200);
  database(db=>{
   for(const table of ['users','stores','products','orders','sessions','auth_tokens'])assert.equal(db.prepare('SELECT COUNT(*) AS n FROM '+table+' WHERE '+({users:'id',stores:'user_id',products:'store_id',orders:'store_id',sessions:'user_id',auth_tokens:'user_id'}[table])+'=?').get(['products','orders'].includes(table)?store.id:ownerId).n,0,table);
   assert.equal(db.prepare('SELECT COUNT(*) AS n FROM upload_usage WHERE user_id=?').get(ownerId).n,0);
   assert.equal(db.prepare('SELECT user_id FROM account_audit WHERE id=?').get('test-audit').user_id,null);
   assert.ok(db.prepare('SELECT id FROM account_audit WHERE action=?').get('store_deleted:'+store.id));
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  });
  r=await request('/api/session','GET',undefined,otherOwner);assert.equal(r.data.store.id,otherStore.id);
  r=await request('/api/products','GET',undefined,otherOwner);assert.equal(r.data[0].details.name,'Keep product');
  r=await request('/api/session','GET',undefined,admin);assert.equal(r.data.user.role,'admin');
  r=await request(route,'DELETE',confirmation,admin);assert.equal(r.status,404);
  r=await signup('delete@example.com','delete-shop');assert.equal(r.status,200,'deleted owner email and slug can be reused');
 }finally{if(server?.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill()});rmSync(dir,{recursive:true,force:true})}
});
