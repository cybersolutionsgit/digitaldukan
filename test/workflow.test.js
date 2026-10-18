import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'dukan-test-'));const port=3456,base=`http://127.0.0.1:${port}`;let child,ownerCookie,adminCookie,store,product,order;
const password='Test-password-1234';
async function request(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
before(async()=>{child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,NODE_ENV:'test',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),10000);child.stdout.on('data',()=>{clearTimeout(timer);resolve()});child.on('exit',()=>reject(Error('Server exited')))});});
after(()=>{child?.kill();rmSync(dir,{recursive:true,force:true});});
test('complete account, approval, product, checkout and moderation workflow',async()=>{
let r=await request('/api/signup','POST',{email:'owner@example.com',password,slug:'test-shop',subscribed:true,details:{name:'Test Shop',whatsapp:'923001234567',delivery:250},sections:[{type:'hero',layout:1},{type:'featured',layout:2}]});assert.equal(r.status,200);ownerCookie=r.cookie;
r=await request('/api/session','GET',undefined,ownerCookie);assert.equal(r.data.user.role,'owner');assert.equal(r.data.store.status,'pending');store=r.data.store;
r=await request('/api/public/test-shop');assert.equal(r.status,403);
r=await request('/api/public/test-shop','GET',undefined,ownerCookie);assert.equal(r.status,200);
r=await request('/api/admin/stores','GET',undefined,ownerCookie);assert.equal(r.status,403);
r=await request('/api/upload','POST',{type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNmcAAAAASUVORK5CYII='});assert.equal(r.status,401);
r=await request('/api/upload','POST',{type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNmcAAAAASUVORK5CYII='},ownerCookie);assert.equal(r.status,200);const image=r.data.url;const img=await fetch(base+image);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/png');
r=await request('/api/upload','POST',{type:'image/png',data:Buffer.from('not an image').toString('base64')},ownerCookie);assert.equal(r.status,400);
r=await request('/api/products','POST',{name:'Ceramic bowl',price:2400,salePrice:2000,stock:5,images:[image],sizes:'Small, Large',colors:'White, Green'},ownerCookie);assert.equal(r.status,200);
r=await request('/api/products','GET',undefined,ownerCookie);product=r.data[0];assert.equal(product.details.stock,5);
r=await request('/api/login','POST',{email:'admin@example.com',password});assert.equal(r.status,200);adminCookie=r.cookie;
r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'rejected',reason:'Please add a description.'},adminCookie);assert.equal(r.status,200);
r=await request('/api/resubmit','POST',{},ownerCookie);assert.equal(r.status,200);
r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'approved'},adminCookie);assert.equal(r.status,400);
const outbox=readdirSync(join(dir,'test-outbox')).map(name=>JSON.parse(readFileSync(join(dir,'test-outbox',name),'utf8')));const verification=outbox.find(mail=>mail.to==='owner@example.com'&&mail.kind==='verify');const verifyToken=new URLSearchParams(new URL(verification.url).hash.slice(1)).get('token');r=await request('/api/auth/verify-email','POST',{token:verifyToken});assert.equal(r.status,200);
r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'approved'},adminCookie);assert.equal(r.status,200);
r=await request('/api/public/test-shop');assert.equal(r.status,200);assert.equal(r.data.products.length,1);assert.equal(r.data.store.user_id,undefined);
r=await request('/api/checkout','POST',{slug:'test-shop',name:'Customer',phone:'03001234567',address:'Lahore',items:[{id:product.id,quantity:2,size:'Small',color:'White',price:1}]});assert.equal(r.status,200);assert.equal(r.data.total,4250);assert.match(r.data.whatsapp,/https:\/\/wa.me\/923001234567/);order=r.data.id;
r=await request('/api/orders','GET',undefined,ownerCookie);assert.equal(r.data.length,1);assert.equal(r.data[0].details.items[0].price,2000);
r=await request('/api/orders/'+order,'PATCH',{status:'Delivered'},ownerCookie);assert.equal(r.status,200);
r=await request('/api/store','PATCH',{details:{...store.details,name:'Updated Shop',logo:image},sections:[{type:'featured',layout:3,title:'Custom collection',text:'Our products'}]},ownerCookie);assert.equal(r.status,200);
r=await request('/api/public/test-shop');assert.equal(r.data.store.details.name,'Test Shop','saved design changes remain private until published');
r=await request('/api/store/publish','POST',{},ownerCookie);assert.equal(r.status,200);
r=await request('/api/public/test-shop');assert.equal(r.data.store.status,'approved');assert.equal(r.data.store.details.name,'Updated Shop');assert.equal(r.data.store.sections[0].title,'Custom collection');assert.equal(r.data.store.details.logo,image);
r=await request('/api/checkout','POST',{slug:'test-shop',name:'C',phone:'03001234567',address:'Lahore',items:[{id:product.id,quantity:9,size:'Small',color:'White'}]});assert.equal(r.status,400);
r=await request('/api/checkout','POST',{slug:'test-shop',name:'C',phone:'03001234567',address:'Lahore',items:[{id:product.id,quantity:1,size:'Invalid',color:'White'}]});assert.equal(r.status,400);
r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'suspended',reason:'Review required'},adminCookie);assert.equal(r.status,200);
r=await request('/api/public/test-shop');assert.equal(r.status,403);
r=await request('/api/checkout','POST',{slug:'test-shop',name:'C',phone:'03001234567',address:'Lahore',items:[{id:product.id,quantity:1,size:'Small',color:'White'}]});assert.equal(r.status,403);
r=await request('/api/admin/stores/'+store.id,'PATCH',{status:'approved'},adminCookie);assert.equal(r.status,200);
r=await request('/api/products/'+product.id,'DELETE',undefined,ownerCookie);assert.equal(r.status,415);
r=await request('/api/products/'+product.id,'DELETE',{},ownerCookie);assert.equal(r.status,200);
r=await request('/api/orders','GET',undefined,ownerCookie);assert.equal(r.data.length,1);
r=await request('/api/logout','POST',{},ownerCookie);assert.equal(r.status,200);
r=await request('/api/orders','GET',undefined,ownerCookie);assert.equal(r.status,401);
});
test('validation and cross-origin protection',async()=>{
let r=await request('/api/signup','POST',{email:'invalid',password:'a'});assert.equal(r.status,400);
r=await request('/api/login','POST',{email:'admin@example.com',password:'wrong'});assert.equal(r.status,401);
const response=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:JSON.stringify({email:'admin@example.com',password})});assert.equal(response.status,403);
});

test('accounts and orders survive a service restart',async()=>{
await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,NODE_ENV:'test',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Restart timed out')),10000);child.stdout.on('data',()=>{clearTimeout(timer);resolve()});child.on('exit',()=>reject(Error('Server exited')))});
let r=await request('/api/login','POST',{email:'owner@example.com',password});assert.equal(r.status,200);
r=await request('/api/orders','GET',undefined,r.cookie);assert.equal(r.data.length,1);assert.equal(r.data[0].status,'Delivered');
});

test('scheme-less social links normalize on signup and updates; unsafe links are rejected', async () => {
 const signup={email:'links@example.com',password,slug:'links-shop',subscribed:true,
  details:{name:'Link Shop',whatsapp:'923001234567',delivery:200,instagram:'  insta.com/abc  ',facebook:'facebook.com/myshop',website:'https://example.com/shop?ref=dukan'},sections:[{type:'contact',layout:1}]};
 let r=await request('/api/signup','POST',signup);assert.equal(r.status,200);const cookie=r.cookie;
 r=await request('/api/session','GET',undefined,cookie);let details=r.data.store.details;
 assert.equal(details.instagram,'https://insta.com/abc');assert.equal(details.facebook,'https://facebook.com/myshop');assert.equal(details.website,'https://example.com/shop?ref=dukan');
 r=await request('/api/store','PATCH',{details:{...details,instagram:'',facebook:'//www.facebook.com/updated',website:'example.org/new'},sections:signup.sections},cookie);assert.equal(r.status,200);
 r=await request('/api/session','GET',undefined,cookie);details=r.data.store.details;
 assert.equal(details.instagram,'');assert.equal(details.facebook,'https://www.facebook.com/updated');assert.equal(details.website,'https://example.org/new');
 for(const bad of ['javascript:alert(1)','data:text/html,hello','not a link','https://user:pass@example.com','instagram']){
  r=await request('/api/store','PATCH',{details:{...details,website:bad},sections:signup.sections},cookie);assert.equal(r.status,400,bad);
 }
 r=await request('/api/session','GET',undefined,cookie);assert.equal(r.data.store.details.website,'https://example.org/new');
});
