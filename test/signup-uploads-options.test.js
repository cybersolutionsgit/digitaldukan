import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {businessDetails} from './fixtures.js';

const base='http://127.0.0.1:3492',password='Signup-options-password-123';
test('signup validates required business details and saves optional uploads atomically; custom option labels survive checkout',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dukan-signup-options-'));let server;
 async function request(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const details={...businessDetails,name:'Flavors Shop',whatsapp:'923001234567',delivery:100},signup={email:'flavors@example.com',password,slug:'flavors-shop',subscribed:true,details,sections:[{type:'hero',layout:1},{type:'featured',layout:1}]};
 const image={type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNmcAAAAASUVORK5CYII='};
 function dbRun(sql){const db=new DatabaseSync(join(dir,'digitaldukan.sqlite'));try{db.exec(sql)}finally{db.close()}}
 try{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3492',DATA_DIR:dir,NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'false',AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve()});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  for(const key of Object.keys(businessDetails)){const r=await request('/api/signup','POST',{...signup,details:{...details,[key]:' '}});assert.equal(r.status,400,key);assert.match(r.data.error,/required/);}
  let r=await request('/api/signup','POST',{...signup,signupImages:{logo:image,banner:{type:'image/png',data:Buffer.from('bad image').toString('base64')}}});assert.equal(r.status,400);
  r=await request('/api/login','POST',{email:signup.email,password});assert.equal(r.status,401,'invalid upload does not create account');
  dbRun("CREATE TRIGGER reject_signup BEFORE INSERT ON upload_usage BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  r=await request('/api/signup','POST',{...signup,signupImages:{logo:image}});assert.equal(r.status,500);
  assert.equal(existsSync(join(dir,'uploads'))?readdirSync(join(dir,'uploads')).length:0,0,'failed signup removes written images');
  dbRun('DROP TRIGGER reject_signup');
  r=await request('/api/signup','POST',{...signup,signupImages:{logo:image}});assert.equal(r.status,200);const owner=r.cookie;
  r=await request('/api/session','GET',undefined,owner);const store=r.data.store;assert.match(store.details.logo,/^\/uploads\//);assert.equal(store.details.banner,'');assert.equal((await fetch(base+store.details.logo)).status,200);
  r=await request('/api/products','POST',{name:'Coffee beans',price:1200,images:[],option1Name:'Weight',sizes:'500g,1kg',option2Name:'Roast',colors:'Light,Dark'},owner);assert.equal(r.status,200);
  r=await request('/api/products','POST',{name:'Invalid labels',price:100,images:[],option1Name:'',sizes:'A,B'},owner);assert.equal(r.status,400);
  r=await request('/api/products','GET',undefined,owner);const product=r.data[0];assert.equal(product.details.option1Name,'Weight');
  r=await request('/api/login','POST',{email:'admin@example.com',password});const admin=r.cookie;
  r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'approved'},admin);assert.equal(r.status,200);
  const checkout={slug:store.slug,name:'Customer',phone:'03001234567',address:'Test address',items:[{id:product.id,quantity:1,size:'500g',color:'Dark'}]};
  r=await request('/api/checkout','POST',{...checkout,items:[{...checkout.items[0],size:'Fake'}]});assert.equal(r.status,400);assert.match(r.data.error,/Weight/);
  r=await request('/api/checkout','POST',checkout);assert.equal(r.status,200);assert.match(decodeURIComponent(r.data.whatsapp),/Weight: 500g/);assert.match(decodeURIComponent(r.data.whatsapp),/Roast: Dark/);
  r=await request('/api/orders','GET',undefined,owner);assert.equal(r.data[0].details.items[0].option1Name,'Weight');
  r=await request('/api/products','POST',{...product.details,id:product.id,option1Name:'Pack'},owner);assert.equal(r.status,200);
  r=await request('/api/orders','GET',undefined,owner);assert.equal(r.data[0].details.items[0].option1Name,'Weight','order keeps original option label');
 }finally{if(server?.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill()});rmSync(dir,{recursive:true,force:true})}
});
