import {businessDetails} from './fixtures.js';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {categoryKits,themes,themeForNiche} from '../public/themes.js';
import {enhanceSection,layoutLabels} from '../public/kit.js';
const dir=mkdtempSync(join(tmpdir(),'dukan-kit-')),base='http://127.0.0.1:3486';let server,cookie,adminCookie,store;
const password='Template-security-password-123';
before(async()=>{server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3486',DATA_DIR:dir,NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'true',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@kit.example',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',()=>reject(Error('Server failed')))});});
after(async()=>{if(server?.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill()});rmSync(dir,{recursive:true,force:true});});
async function req(path,method='GET',body,auth=cookie){const response=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(auth?{cookie:auth}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
test('30 categories have five complete layout choices for every section',()=>{assert.equal(categoryKits.length,30);assert.equal(new Set(categoryKits.map(k=>k.id)).size,30);for(const kit of categoryKits){assert.equal(themeForNiche(kit.category,''),kit.id);assert.equal(themes[kit.id].samples.length,4);}for(const labels of Object.values(layoutLabels)){assert.equal(labels.length,5);assert.equal(new Set(labels).size,5);}});
test('photos and descriptions are escaped and stock imagery is not presented as customer testimony',()=>{const markup=enhanceSection('<section class="store-section"><h2>Talk to us</h2></section>',{type:'contact',layout:5,image:'https://example.com/"x',imageAlt:'<script>bad</script>'},{theme:'fashion'},s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'));assert.ok(markup.includes('&quot;x'));assert.ok(!markup.includes('<script>'));});
test('saved designs stay private, published delivery prices match checkout, restore does not erase inventory',async()=>{
 let r=await req('/api/signup','POST',{email:'owner@kit.example',password,slug:'kit-shop',subscribed:true,details:{...businessDetails,name:'Original Shop',whatsapp:'923001234567',delivery:200,category:'Bakery & desserts',seoTitle:'Original title'},sections:[{type:'hero',layout:4},{type:'contact',layout:5}]},'');assert.equal(r.status,200);cookie=r.cookie;store=(await req('/api/session')).data.store;
 const mail=readdirSync(join(dir,'test-outbox')).map(n=>JSON.parse(readFileSync(join(dir,'test-outbox',n)))).find(x=>x.kind==='verify');const token=new URLSearchParams(new URL(mail.url).hash.slice(1)).get('token');assert.equal((await req('/api/auth/verify-email','POST',{token})).status,200);
 adminCookie=(await req('/api/login','POST',{email:'admin@kit.example',password},'')).cookie;assert.equal((await req('/api/admin/stores/'+store.id,'PATCH',{status:'approved'},adminCookie)).status,200);
 assert.equal((await req('/api/store/publish','POST',{})).status,400,'publish needs a product');assert.equal((await req('/api/store/publish','POST',{},'')).status,401);
 assert.equal((await req('/api/products','POST',{name:'Cake',price:1000,images:['/stock/product-tshirt.webp']})).status,200);const product=(await req('/api/products')).data[0];
 const saved={...store.details,name:'New Shop',delivery:500,seoTitle:'Bakery <safe> title',seoDescription:'Fresh cakes & cookies',favicon:'https://example.com/favicon.png'};
 r=await req('/api/store','PATCH',{details:saved,sections:[{type:'hero',layout:5,title:'New heading',image:'https://example.com/photo.jpg',imagePosition:'top',imageAlt:'Our bakery'},{type:'contact',layout:4}]});assert.equal(r.status,200);
 assert.equal((await req('/api/public/kit-shop','GET',undefined,'')).data.store.details.name,'Original Shop');assert.equal((await req('/api/public/kit-shop')).data.store.details.name,'New Shop');assert.equal((await req('/api/public/kit-shop?published=1')).data.store.details.name,'Original Shop');
 const order={slug:'kit-shop',name:'Buyer',phone:'03001234567',address:'Lahore',items:[{id:product.id,quantity:1}]};assert.equal((await req('/api/checkout','POST',order,'')).data.total,1200,'checkout uses published delivery');
 let html=await(await fetch(base+'/s/kit-shop')).text();assert.ok(html.includes('<title>Original title</title>'));assert.ok(!html.includes('Bakery &lt;safe&gt; title'));
 assert.equal((await req('/api/store/publish','POST',{})).status,200);assert.equal((await req('/api/public/kit-shop','GET',undefined,'')).data.store.sections[0].imagePosition,'top');assert.equal((await req('/api/checkout','POST',order,'')).data.total,1500);
 html=await(await fetch(base+'/s/kit-shop')).text();assert.ok(html.includes('<title>Bakery &lt;safe&gt; title</title>'));assert.ok(html.includes('property="og:description" content="Fresh cakes &amp; cookies"'));assert.ok(html.includes('rel="icon"'));
 assert.equal((await req('/api/store','PATCH',{details:{...businessDetails,...saved,name:'Discard me'},sections:store.sections})).status,200);assert.equal((await req('/api/store/discard','POST',{})).status,200);assert.equal((await req('/api/session')).data.store.details.name,'New Shop');assert.equal((await req('/api/products')).data.length,1);
 for(const image of ['javascript:alert(1)','/../../secrets','data:text/html,bad'])assert.equal((await req('/api/store','PATCH',{details:saved,sections:[{type:'hero',layout:5,image}]})).status,400);
 assert.equal((await req('/api/store','PATCH',{details:saved,sections:[{type:'hero',layout:6}]})).status,400);
});

test('service enquiries use saved store mode, ignore delivery spoofing and do not promise COD or a booking',async()=>{
 let r=await req('/api/signup','POST',{email:'service@kit.example',password,slug:'service-kit',subscribed:true,details:{...businessDetails,name:'Creative Studio',theme:'digital',whatsapp:'923001234567',delivery:9999},sections:[{type:'hero',layout:1},{type:'featured',layout:1}]},'');assert.equal(r.status,200);const serviceCookie=r.cookie;
 const service=(await req('/api/session','GET',undefined,serviceCookie)).data.store;assert.equal(service.details.businessMode,'enquiry');
 const mail=readdirSync(join(dir,'test-outbox')).map(n=>JSON.parse(readFileSync(join(dir,'test-outbox',n)))).find(x=>x.kind==='verify'&&x.to==='service@kit.example');const token=new URLSearchParams(new URL(mail.url).hash.slice(1)).get('token');assert.equal((await req('/api/auth/verify-email','POST',{token},serviceCookie)).status,200);
 assert.equal((await req('/api/products','POST',{name:'Brand design',price:5000,images:['/stock/product-tshirt.webp']},serviceCookie)).status,200);const product=(await req('/api/products','GET',undefined,serviceCookie)).data[0];assert.equal((await req('/api/admin/stores/'+service.id,'PATCH',{status:'approved'},adminCookie)).status,200);
 r=await req('/api/checkout','POST',{slug:'service-kit',name:'Client',phone:'03001234567',notes:'Logo and packaging',delivery:1,total:1,businessMode:'retail',items:[{id:product.id,quantity:1,price:1}]},'');assert.equal(r.status,200);assert.equal(r.data.kind,'enquiry');assert.equal(r.data.total,5000);const message=new URL(r.data.whatsapp).searchParams.get('text');assert.ok(message.includes('Service enquiry'));assert.ok(message.includes('Logo and packaging'));assert.ok(!message.includes('Cash on Delivery'));assert.ok(!message.includes('Delivery:'));assert.ok(message.includes('not a confirmed booking'));
 const orders=(await req('/api/orders','GET',undefined,serviceCookie)).data;assert.equal(orders[0].details.kind,'enquiry');assert.equal(orders[0].details.delivery,0);assert.equal(orders[0].details.address,'');
 r=await req('/api/checkout','POST',{slug:'service-kit',name:'Client',phone:'bad',items:[{id:product.id,quantity:1}]},'');assert.equal(r.status,400);
 r=await req('/api/store','PATCH',{details:{...businessDetails,...service.details,businessMode:'retail'},sections:service.sections},serviceCookie);assert.equal(r.status,200);assert.equal((await req('/api/store/publish','POST',{},serviceCookie)).status,200);
 r=await req('/api/checkout','POST',{slug:'service-kit',name:'Client',phone:'03001234567',items:[{id:product.id,quantity:1}]},'');assert.equal(r.status,400,'a published retail store still requires an address');
 r=await req('/api/checkout','POST',{slug:'service-kit',name:'Client',phone:'03001234567',address:'Lahore',items:[{id:product.id,quantity:1}]},'');assert.equal(r.status,200);assert.equal(r.data.kind,'order');assert.equal(r.data.total,14999);assert.ok(new URL(r.data.whatsapp).searchParams.get('text').includes('Cash on Delivery'));
});
