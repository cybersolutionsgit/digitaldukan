import {isServiceStore} from './public/store-mode.js';
import http from 'node:http';
import { themes, themeForNiche } from './public/themes.js';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, chmodSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { sendAccountEmail, emailConfigured, appUrl } from './email.js';
import { createBackup, listBackups, backupFile, backupRetention } from './backups.js';
// Temporarily paused at the owner's request. Flip the default to true to restore
// verification in one change; an explicit hosting variable overrides this default.
const emailVerificationDefault=false;
const verificationEnabled=process.env.EMAIL_VERIFICATION_ENABLED===undefined?emailVerificationDefault:process.env.EMAIL_VERIFICATION_ENABLED==='true';
const verificationPausedMessage='Email verification is temporarily paused. You can continue without verifying your email; admin approval is still required.';
const dir=process.env.DATA_DIR||'./data'; mkdirSync(dir,{recursive:true,mode:0o700});
const db=new DatabaseSync(join(dir,'digitaldukan.sqlite'));chmodSync(join(dir,'digitaldukan.sqlite'),0o600);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password TEXT,role TEXT);
CREATE TABLE IF NOT EXISTS stores(id TEXT PRIMARY KEY,user_id TEXT UNIQUE REFERENCES users(id),slug TEXT UNIQUE,status TEXT,reason TEXT DEFAULT '',details TEXT,sections TEXT,subscription INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,store_id TEXT REFERENCES stores(id),details TEXT);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,store_id TEXT REFERENCES stores(id),status TEXT,details TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS auth_tokens(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);
CREATE TABLE IF NOT EXISTS upload_usage(name TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),bytes INTEGER);
CREATE TABLE IF NOT EXISTS account_audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),user_id TEXT REFERENCES users(id),action TEXT,created TEXT);`);
if(!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='email_verified'))db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
for(const column of ['published_details','published_sections','published_at','draft_saved_at'])if(!db.prepare('PRAGMA table_info(stores)').all().some(c=>c.name===column))db.exec('ALTER TABLE stores ADD COLUMN '+column+' TEXT');
const cleanup=()=>{db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('DELETE FROM auth_tokens WHERE expires<?').run(Date.now());db.prepare('DELETE FROM rate_limits WHERE expires<?').run(Date.now());};
for(const name of ['digitaldukan.sqlite-wal','digitaldukan.sqlite-shm'])if(statSync(join(dir,name),{throwIfNoEntry:false}))chmodSync(join(dir,name),0o600);
cleanup();
setInterval(cleanup,3600000).unref();
const id=()=>randomBytes(12).toString('hex');
const hash=p=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex')};
const dummyPasswordHash=hash(randomBytes(32).toString('hex'));
const verify=(p,h)=>{const [s,k]=h.split(':');return timingSafeEqual(scryptSync(p,s,64),Buffer.from(k,'hex'))};
const emailValid=e=>typeof e==='string'&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const adminEmail=process.env.ADMIN_EMAIL?.toLowerCase(),adminPassword=process.env.ADMIN_PASSWORD;
if(adminEmail&&adminPassword){if(!emailValid(adminEmail)||adminPassword.length<12)throw Error('Admin requires valid email and password of at least 12 characters'); const existing=db.prepare('SELECT * FROM users WHERE email=?').get(adminEmail);if(existing&&existing.role!=='admin')throw Error('Admin email already belongs to a store owner');if(!existing)db.prepare('INSERT INTO users(id,email,password,role,email_verified) VALUES(?,?,?,?,1)').run(id(),adminEmail,hash(adminPassword),'admin');else db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(existing.id);}
const imageValid=x=>/^https:\/\//.test(x)||/^\/stock\/[a-z0-9-]+\.webp$/.test(x)||/^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(x);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
const parse=r=>({...r,details:JSON.parse(r.details),...(r.sections?{sections:JSON.parse(r.sections)}:{})});
const storeFor=u=>{const r=db.prepare('SELECT * FROM stores WHERE user_id=?').get(u.id);return r?parse(r):null};
const publicStore=s=>({id:s.id,slug:s.slug,status:s.status,details:s.details,sections:s.sections});
const sessionUser=req=>{const cookie=req.headers.cookie?.match(/(?:^|;\s*)session=([a-f0-9]+)/)?.[1];return cookie?db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(createHash('sha256').update(cookie).digest('hex'),Date.now()):null};
function login(res,u){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),u.id,Date.now()+7*86400000);res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);}
function rate(req,key,max=15,window=900000,subject=''){
  const k=createHash('sha256').update(key+':'+(subject||req.socket.remoteAddress||'')).digest('hex');
  const now=Date.now(),existing=db.prepare('SELECT * FROM rate_limits WHERE key=?').get(k);
  const count=existing&&existing.expires>now?existing.count+1:1;
  const expires=existing&&existing.expires>now?existing.expires:now+window;
  db.prepare('INSERT INTO rate_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires=excluded.expires').run(k,count,expires);
  if(count>max)rateError(expires-now);
}
function rateError(milliseconds){
  const seconds=Math.max(1,Math.ceil(milliseconds/1000));
  const minutes=Math.floor(seconds/60),remainder=seconds%60;
  const wait=minutes?`${minutes} minute${minutes===1?'':'s'}${remainder?` ${remainder} seconds`:''}`:`${seconds} second${seconds===1?'':'s'}`;
  throw Object.assign(Error('Too many attempts. Please try again in '+wait+'.'),{status:429,retryAfter:seconds});
}
function resetRates(req,email){
  const now=Date.now();
  // Versioned reset counters retire the previous stricter policy without touching login limits.
  const rules=[['forgot-global-v2',30,900000,req.socket.remoteAddress||''],['forgot-email-v2',10,900000,email],['forgot-cooldown-v2',1,60000,email]];
  const counters=rules.map(([name,max,window,subject])=>{
    const key=createHash('sha256').update(name+':'+subject).digest('hex');
    const row=db.prepare('SELECT * FROM rate_limits WHERE key=?').get(key);
    return {key,max,count:row&&row.expires>now?row.count:0,expires:row&&row.expires>now?row.expires:now+window};
  });
  const blocked=counters.filter(c=>c.count>=c.max);
  if(blocked.length)rateError(Math.max(...blocked.map(c=>c.expires))-now);
  db.exec('BEGIN');try{
    for(const c of counters)db.prepare('INSERT INTO rate_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires=excluded.expires').run(c.key,c.count+1,c.expires);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
const tokenHash=token=>createHash('sha256').update(token).digest('hex');
async function accountEmail(user,kind){
  if(kind==='verify'&&!verificationEnabled)fail(verificationPausedMessage,503);
  if(!emailConfigured())fail('Email delivery is not configured. Please contact the site administrator.',503);
  try{appUrl();}catch{fail('The email website address is not configured correctly. Ask the administrator to check APP_URL.',503);}
  const token=randomBytes(32).toString('hex'),hashed=tokenHash(token),expires=Date.now()+(kind==='verify'?86400000:1800000);
  db.prepare('INSERT INTO auth_tokens VALUES(?,?,?,?)').run(hashed,user.id,kind,expires);
  try{await sendAccountEmail({to:user.email,kind,token,dataDir:dir});}
  catch(error){db.prepare('DELETE FROM auth_tokens WHERE token=?').run(hashed);fail(error.message,503);}
  db.prepare('DELETE FROM auth_tokens WHERE user_id=? AND kind=? AND token<>?').run(user.id,kind,hashed);
}
function usableToken(token,kind){
  if(typeof token!=='string'||!/^([a-f0-9]{64})$/.test(token))fail('This link is invalid or expired. Please request a new email.');
  const row=db.prepare('SELECT auth_tokens.*,users.role FROM auth_tokens JOIN users ON users.id=auth_tokens.user_id WHERE token=? AND kind=? AND expires>?').get(tokenHash(token),kind,Date.now());
  if(!row)fail('This link is invalid or expired. Please request a new email.');return row;
}
const outgoingMail=new Set();
function queueResetEmail(user){const pending=accountEmail(user,'reset').catch(()=>console.error('Password reset delivery failed; check email provider settings.')).finally(()=>outgoingMail.delete(pending));outgoingMail.add(pending);}
let lastBackupError='';
async function runBackup(){try{const result=await createBackup(db,dir);lastBackupError='';return result;}catch(error){lastBackupError=error.message;throw error;}}

const allowedSections=['hero','categories','featured','offers','about','reviews','benefits','contact'];
function normalizeSocialLink(value){
  const raw=String(value??'').trim();
  if(!raw)return '';
  const invalid=()=>fail('Enter a valid social or website link, for example instagram.com/yourname.');
  if(raw.length>2000||/\s|\\/.test(raw))invalid();
  let candidate=raw;
  if(candidate.startsWith('//'))candidate='https:'+candidate;
  else if(!/^[a-z][a-z0-9+.-]*:/i.test(candidate))candidate='https://'+candidate;
  let url;try{url=new URL(candidate)}catch{invalid()}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||url.hostname.startsWith('.')||url.hostname.endsWith('.')||!url.hostname.split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)))invalid();
  return url.href;
}
function details(d){if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>100)fail('Store name is required (maximum 100 characters).');if(!/^\+?[0-9 ()-]{10,20}$/.test(d.whatsapp||''))fail('Enter a valid WhatsApp number with country code.');if(!Number.isFinite(Number(d.delivery))||Number(d.delivery)<0||Number(d.delivery)>100000)fail('Enter valid delivery charges.');if(d.businessMode!==undefined&&!['retail','enquiry'].includes(d.businessMode))fail('Choose a valid selling mode.');for(const key of ['logo','banner','shareImage','favicon'])if(d[key]&&!imageValid(d[key]))fail('Use an uploaded image or an HTTPS image URL.');if(d.theme!==undefined&&!Object.hasOwn(themes,d.theme))fail('Choose a valid store theme.');if(d.niche!==undefined&&(typeof d.niche!=='string'||d.niche.length>200))fail('Describe your niche in 200 characters or fewer.');const social=Object.fromEntries(['instagram','facebook','website'].map(key=>[key,normalizeSocialLink(d[key])]));return Object.fromEntries(['name','description','category','niche','theme','whatsapp','address','logo','banner','instagram','facebook','website','returns','deliveryInfo','accent','delivery','seoTitle','seoDescription','shareImage','favicon','businessMode'].map(k=>[k,k==='businessMode'?(d.businessMode||(isServiceStore(d)?'enquiry':'retail')):k==='theme'?(d.theme||'classic'):k==='delivery'?Number(d[k]):Object.hasOwn(social,k)?social[k]:String(d[k]||'').slice(0,5000)]));}
function sections(s){if(!Array.isArray(s)||s.length<1||s.length>8||s.some(x=>!x||typeof x!=='object')||new Set(s.map(x=>x.type)).size!==s.length||s.some(x=>!allowedSections.includes(x.type)||![1,2,3,4,5].includes(x.layout)))fail('Select between 1 and 8 valid sections.');return s.map(x=>({type:x.type,layout:x.layout,title:String(x.title||'').slice(0,150),text:String(x.text||'').slice(0,5000),image:x.image?validSectionImage(x.image):'',imageAlt:String(x.imageAlt||'').slice(0,250),imagePosition:['center','top','bottom','left','right'].includes(x.imagePosition)?x.imagePosition:'center',mobileImagePosition:['center','top','bottom','left','right'].includes(x.mobileImagePosition)?x.mobileImagePosition:(['center','top','bottom','left','right'].includes(x.imagePosition)?x.imagePosition:'center')}));}
function validSectionImage(value){if(typeof value!=='string'||value.length>2000||!imageValid(value))fail('Choose an uploaded photo or a public HTTPS image.');return value;}
function liveVersion(s){return s.published_details?{...s,details:JSON.parse(s.published_details),sections:JSON.parse(s.published_sections)}:s;}
async function api(req,res,path,b){const u=sessionUser(req);const auth=()=>{if(!u)fail('Please sign in.',401);return u};const owner=()=>{const s=storeFor(auth());if(!s)fail('Store not found.',404);return s};const admin=()=>{if(auth().role!=='admin')fail('Admin access required.',403)};
if(path==='/api/site'&&req.method==='GET'){const domain=process.env.BASE_DOMAIN,host=(req.headers.host||'').split(':')[0];return {slug:domain&&host.endsWith('.'+domain)?host.slice(0,-domain.length-1):null};}
if(path==='/api/upload'&&req.method==='POST'){const owningStore=owner();rate(req,'upload',40,900000,owningStore.user_id);if(!['image/png','image/jpeg','image/webp'].includes(b.type)||typeof b.data!=='string'||b.data.length>2800000)fail('Choose a PNG, JPEG or WebP image under 2 MB.');const bytes=Buffer.from(b.data,'base64');if(bytes.length>2*1024*1024)fail('Image must be under 2 MB.');const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;if(!type)fail('Invalid image file.');const used=db.prepare('SELECT COALESCE(SUM(bytes),0) AS total FROM upload_usage WHERE user_id=?').get(owningStore.user_id).total;if(used+bytes.length>32*1024*1024)fail('Your test-store photo storage limit (32 MB) has been reached.');const uploadsDir=join(dir,'uploads');const globalUsed=statSync(uploadsDir,{throwIfNoEntry:false})?readdirSync(uploadsDir).reduce((sum,name)=>sum+statSync(join(uploadsDir,name)).size,0):0;if(globalUsed+bytes.length>64*1024*1024)fail('Photo storage is full. Ask the administrator to increase storage.');const filename=id()+'.'+type;mkdirSync(join(dir,'uploads'),{recursive:true});writeFileSync(join(dir,'uploads',filename),bytes);db.prepare('INSERT INTO upload_usage VALUES(?,?,?)').run(filename,owningStore.user_id,bytes.length);return {url:'/uploads/'+filename};}
if(path==='/api/session'&&req.method==='GET')return {user:u?{id:u.id,email:u.email,role:u.role,emailVerified:Boolean(u.email_verified)}:null,store:u?storeFor(u):null,emailEnabled:emailConfigured(),verificationEnabled};
if(path==='/api/signup'&&req.method==='POST'){rate(req,'signup');const email=String(b.email||'').trim().toLowerCase();if(!emailValid(email))fail('Enter a valid email.');if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)fail('Password must have 8–128 characters.');const slug=String(b.slug||'').toLowerCase();if(!/^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/.test(slug)||['admin','api','www','dashboard','login','signup','store','digitaldukan'].includes(slug))fail('Choose a store address of 4–40 letters, numbers or hyphens.');if(b.subscribed!==true)fail('Activate the free subscription to continue.');const initial={...b.details};if(!initial.theme){initial.theme=themeForNiche(initial.category,initial.niche);if(!initial.accent)initial.accent=themes[initial.theme].accent;}const d=details(initial),s=sections(b.sections);if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail('This email already has an account.');if(db.prepare('SELECT id FROM stores WHERE slug=?').get(slug))fail('This store address is already taken.');const uid=id();db.exec('BEGIN');try{db.prepare('INSERT INTO users(id,email,password,role) VALUES(?,?,?,?)').run(uid,email,hash(b.password),'owner');db.prepare('INSERT INTO stores(id,user_id,slug,status,details,sections) VALUES(?,?,?,?,?,?)').run(id(),uid,slug,'pending',JSON.stringify(d),JSON.stringify(s));db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}login(res,{id:uid});let verificationEmailSent=false;try{if(verificationEnabled&&emailConfigured()){await accountEmail({id:uid,email},'verify');verificationEmailSent=true;}}catch{ /* Account already exists; dashboard offers a resend without repeating signup. */ }return {ok:true,verificationEmailSent};}
if(path==='/api/login'&&req.method==='POST'){rate(req,'login-global',300);rate(req,'login-account',15,900000,String(b.email||'').trim().toLowerCase());const r=db.prepare('SELECT * FROM users WHERE email=?').get(String(b.email||'').trim().toLowerCase());const passwordMatches=typeof b.password==='string'&&b.password.length<=128&&verify(b.password,r?.password||dummyPasswordHash);if(!r||!passwordMatches)fail('Email or password is incorrect.',401);login(res,r);return {ok:true,role:r.role};}
if(path==='/api/logout'&&req.method==='POST'){const t=req.headers.cookie?.match(/session=([a-f0-9]+)/)?.[1];if(t)db.prepare('DELETE FROM sessions WHERE token=?').run(createHash('sha256').update(t).digest('hex'));res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':''));return {ok:true};}
if(path==='/api/auth/forgot-password'&&req.method==='POST'){
 const email=String(b.email||'').trim().toLowerCase();if(!emailValid(email))fail('Enter a valid email.');
 resetRates(req,email);
 if(!emailConfigured())fail('Email delivery is not configured. Please contact the site administrator.',503);
 const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 if(user)queueResetEmail(user);
 return {ok:true,message:'If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder.'};
}
if(path==='/api/auth/reset-password'&&req.method==='POST'){
 rate(req,'reset',30);const token=usableToken(b.token,'reset');
 const minimum=token.role==='admin'?12:8;
 if(typeof b.password!=='string'||b.password.length<minimum||b.password.length>128)fail('New password must have '+minimum+'–128 characters.');
 const password=hash(b.password);db.exec('BEGIN');try{
 db.prepare('UPDATE users SET password=? WHERE id=?').run(password,token.user_id);
 db.prepare('DELETE FROM sessions WHERE user_id=?').run(token.user_id);
 db.prepare('DELETE FROM auth_tokens WHERE user_id=?').run(token.user_id);
 db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':''));
 return {ok:true};
}
if(path==='/api/auth/resend-verification'&&req.method==='POST'){
 auth();if(!verificationEnabled)fail(verificationPausedMessage,503);if(u.email_verified)return {ok:true,message:'Your email is already verified.'};
 rate(req,'verify-user',1,60000,u.id);rate(req,'verify-ip',20);
 await accountEmail(u,'verify');return {ok:true,message:'Verification email sent. Check your inbox and spam folder.'};
}
if(path==='/api/auth/verify-email'&&req.method==='POST'){
 if(!verificationEnabled)fail(verificationPausedMessage,503);
 rate(req,'verify-token',30);const token=usableToken(b.token,'verify');
 db.exec('BEGIN');try{db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(token.user_id);db.prepare('DELETE FROM auth_tokens WHERE user_id=? AND kind=?').run(token.user_id,'verify');db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return {ok:true};
}
if(path==='/api/admin/backups'&&req.method==='GET'){admin();return {items:listBackups(dir),lastError:lastBackupError,automatic:process.env.AUTO_BACKUPS!=='false',keep:backupRetention()};}
if(path==='/api/admin/backups'&&req.method==='POST'){admin();rate(req,'backup-user',4,3600000,u.id);try{return {ok:true,backup:await runBackup()};}catch(error){fail(error.message,503);}}
if(path.startsWith('/api/admin/backups/')&&req.method==='GET'){admin();const file=backupFile(dir,path.split('/').pop());if(!file)fail('Backup not found.',404);return {downloadFile:file};}
if(path==='/api/store'&&req.method==='PATCH'){const s=owner(),d=details(b.details),content=sections(b.sections);db.prepare('UPDATE stores SET published_details=COALESCE(published_details,details),published_sections=COALESCE(published_sections,sections),details=?,sections=?,draft_saved_at=? WHERE id=?').run(JSON.stringify(d),JSON.stringify(content),new Date().toISOString(),s.id);return {ok:true,savedAt:new Date().toISOString()};}
if(path==='/api/store/publish'&&req.method==='POST'){const s=owner();if(!s.details.whatsapp)fail('Add your WhatsApp number first.');if(!db.prepare('SELECT id FROM products WHERE store_id=? LIMIT 1').get(s.id))fail('Add at least one product before publishing.');const now=new Date().toISOString();db.prepare('UPDATE stores SET published_details=details,published_sections=sections,published_at=? WHERE id=?').run(now,s.id);return {ok:true,publishedAt:now,message:s.status==='approved'?'Your changes are now live.':'Design published. Your store remains private until administrator approval.'};}
if(path==='/api/store/discard'&&req.method==='POST'){const s=owner();if(!s.published_details)fail('There is no published design to restore.');db.prepare('UPDATE stores SET details=published_details,sections=published_sections WHERE id=?').run(s.id);return {ok:true};}

if(path==='/api/resubmit'&&req.method==='POST'){const s=owner();if(s.status!=='rejected')fail('Only rejected stores can resubmit.');db.prepare("UPDATE stores SET status='pending',reason='' WHERE id=?").run(s.id);return {ok:true};}
if(path==='/api/products'&&req.method==='GET'){const s=owner();return db.prepare('SELECT * FROM products WHERE store_id=?').all(s.id).map(parse);}
if(path==='/api/products'&&req.method==='POST'){const s=owner(),p=b; if(typeof p.name!=='string'||!p.name.trim()||p.name.length>150||!Number.isFinite(Number(p.price))||Number(p.price)<=0||Number(p.price)>100000000)fail('Product name and positive price are required.');if(p.salePrice!==''&&p.salePrice!=null&&(!Number.isFinite(Number(p.salePrice))||Number(p.salePrice)<=0||Number(p.salePrice)>=Number(p.price)))fail('Sale price must be positive and lower than the regular price.');if(p.stock!==''&&p.stock!=null&&(!Number.isInteger(Number(p.stock))||Number(p.stock)<0||Number(p.stock)>1000000))fail('Stock must be a nonnegative whole number.');if(!Array.isArray(p.images)||p.images.length>8||p.images.some(x=>!imageValid(x)))fail('Use up to 8 HTTPS image URLs.');const clean={name:p.name.trim(),price:Number(p.price),salePrice:p.salePrice===''||p.salePrice==null?null:Number(p.salePrice),stock:p.stock===''||p.stock==null?null:Number(p.stock),images:p.images,description:String(p.description||'').slice(0,5000),category:String(p.category||'').slice(0,100),sizes:String(p.sizes||'').slice(0,300),colors:String(p.colors||'').slice(0,300)};if(p.id){const r=db.prepare('UPDATE products SET details=? WHERE id=? AND store_id=?').run(JSON.stringify(clean),p.id,s.id);if(!r.changes)fail('Product not found.',404)}else db.prepare('INSERT INTO products VALUES(?,?,?)').run(id(),s.id,JSON.stringify(clean));return {ok:true};}
if(path.startsWith('/api/products/')&&req.method==='DELETE'){const s=owner();db.prepare('DELETE FROM products WHERE id=? AND store_id=?').run(path.split('/').pop(),s.id);return {ok:true};}
if(path==='/api/orders'&&req.method==='GET'){const s=owner();return db.prepare('SELECT * FROM orders WHERE store_id=? ORDER BY created DESC').all(s.id).map(parse);}
if(path.startsWith('/api/orders/')&&req.method==='PATCH'){const s=owner();if(!['New','Confirmed','Delivered','Cancelled'].includes(b.status))fail('Invalid order status.');if(!db.prepare('UPDATE orders SET status=? WHERE id=? AND store_id=?').run(b.status,path.split('/').pop(),s.id).changes)fail('Order not found.',404);return {ok:true};}
const recoveryPath=path.match(/^\/api\/admin\/stores\/([a-f0-9]{24})\/account$/);
if(recoveryPath&&req.method==='POST'){
 admin();rate(req,'admin-account-recovery',10,900000,u.id);
 if(typeof b.adminPassword!=='string'||b.adminPassword.length>128||!verify(b.adminPassword,u.password))fail('Your admin password is incorrect. Confirm your current admin password.',403);
 const target=db.prepare("SELECT users.* FROM users JOIN stores ON stores.user_id=users.id WHERE stores.id=? AND users.role='owner'").get(recoveryPath[1]);
 if(!target)fail('Store owner not found.',404);
 const email=b.email===undefined?target.email:String(b.email).trim().toLowerCase();
 if(!emailValid(email))fail('Enter a valid owner email address.');
 const emailChanged=email!==target.email,passwordChanged=b.newPassword!==undefined&&b.newPassword!=='';
 if(passwordChanged&&(typeof b.newPassword!=='string'||b.newPassword.length<8||b.newPassword.length>128))fail('Owner password must have 8–128 characters.');
 if(passwordChanged&&b.confirmPassword!==b.newPassword)fail('The two owner passwords do not match.');
 if(!emailChanged&&!passwordChanged)fail('Enter a different email or a new password to save changes.');
 if(emailChanged&&db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email,target.id))fail('This email already belongs to another account.');
 const password=passwordChanged?hash(b.newPassword):target.password;
 db.exec('BEGIN');try{
  db.prepare('UPDATE users SET email=?,password=?,email_verified=? WHERE id=?').run(email,password,emailChanged?0:target.email_verified,target.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  db.prepare('DELETE FROM auth_tokens WHERE user_id=?').run(target.id);
  for(const action of [emailChanged?'email_changed':null,passwordChanged?'password_reset':null].filter(Boolean))db.prepare('INSERT INTO account_audit VALUES(?,?,?,?,?)').run(id(),u.id,target.id,action,new Date().toISOString());
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 let verificationEmailSent=false;
 if(emailChanged&&verificationEnabled&&emailConfigured()){try{await accountEmail({id:target.id,email},'verify');verificationEmailSent=true;}catch{}}
 return {ok:true,emailChanged,passwordChanged,verificationEmailSent,message:'Owner account updated. All previous owner sessions and account links have been revoked.'+(emailChanged&&verificationEnabled?(verificationEmailSent?' Verification email sent to the new address.':' The new address needs verification; the owner can request a verification email after signing in.'):'')};
}
if(path==='/api/admin/stores'&&req.method==='GET'){admin();return db.prepare('SELECT stores.*, users.email, users.email_verified FROM stores JOIN users ON users.id=stores.user_id').all().map(parse);}
if(path.startsWith('/api/admin/stores/')&&req.method==='PATCH'){
 admin();const storeId=path.split('/').pop();
 if(!['approved','rejected','suspended'].includes(b.status))fail('Invalid status.');
 if(['rejected','suspended'].includes(b.status)&&(typeof b.reason!=='string'||!b.reason.trim()))fail('Please provide a reason.');
 const target=db.prepare('SELECT stores.status,users.email_verified FROM stores JOIN users ON users.id=stores.user_id WHERE stores.id=?').get(storeId);
 if(!target)fail('Store not found.',404);
 const firstApproval=b.status==='approved'&&['pending','rejected'].includes(target.status);
 if(verificationEnabled&&firstApproval&&!target.email_verified)fail('The store owner must verify their email before approval.');
 if(firstApproval)db.prepare('UPDATE stores SET status=?,reason=?,published_details=details,published_sections=sections,published_at=? WHERE id=?').run(b.status,String(b.reason||'').slice(0,1000),new Date().toISOString(),storeId);
 else db.prepare('UPDATE stores SET status=?,reason=? WHERE id=?').run(b.status,String(b.reason||'').slice(0,1000),storeId);
 return {ok:true};
}
if(path.startsWith('/api/public/')&&req.method==='GET'){const slug=path.split('/').pop();const row=db.prepare('SELECT * FROM stores WHERE slug=?').get(slug);if(!row)fail('Store not found.',404);if(row.status!=='approved'&&(!u||(u.id!==row.user_id&&u.role!=='admin')))fail('This store is not currently available.',403);const parsed=parse(row),isEditor=u&&(u.id===row.user_id||u.role==='admin')&&new URL(req.url,'http://localhost').searchParams.get('published')!=='1',s=isEditor?parsed:liveVersion(parsed);return {store:publicStore(s),preview:Boolean(isEditor),products:db.prepare('SELECT * FROM products WHERE store_id=?').all(s.id).map(parse)};}
if(path==='/api/checkout'&&req.method==='POST'){
 rate(req,'checkout',30);const row=db.prepare("SELECT * FROM stores WHERE slug=? AND status='approved'").get(b.slug);
 if(!row)fail('This store is not accepting orders.',403);
 const s=liveVersion(parse(row)),service=isServiceStore(s.details);
 for(const k of service?['name','phone']:['name','phone','address'])if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>1000)fail(service?'Name and phone are required.':'Name, phone and delivery address are required.');
 if(!/^\+?[0-9 ()-]{7,20}$/.test(b.phone))fail('Enter a valid phone number.');
 if(b.notes!==undefined&&(typeof b.notes!=='string'||b.notes.length>2000))fail('Keep your enquiry under 2000 characters.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>100)fail(service?'Choose at least one service.':'Your cart is empty or too large.');
 const seen=new Set(),quantities=new Map();const items=b.items.map(i=>{
  if(!i||typeof i!=='object'||typeof i.id!=='string')fail('Invalid cart item.');
  const key=JSON.stringify([i.id,i.size||'',i.color||'']);if(seen.has(key))fail('Duplicate cart item.');seen.add(key);
  const r=db.prepare('SELECT * FROM products WHERE id=? AND store_id=?').get(i.id,s.id);
  if(!r||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100)fail('Invalid product or quantity.');
  const p=parse(r).details;quantities.set(i.id,(quantities.get(i.id)||0)+i.quantity);
  if(p.stock!==null&&quantities.get(i.id)>p.stock)fail(`${p.name} does not have enough stock.`);
  for(const [key,source]of [['size','sizes'],['color','colors']]){const opts=p[source].split(',').map(x=>x.trim()).filter(Boolean);if(opts.length&&!opts.includes(i[key]))fail(`Choose a valid ${key} for ${p.name}.`);}
  return {id:i.id,name:p.name,price:p.salePrice??p.price,quantity:i.quantity,size:String(i.size||''),color:String(i.color||'')};
 });
 const subtotal=items.reduce((n,i)=>n+i.price*i.quantity,0),delivery=service?0:s.details.delivery,total=subtotal+delivery,oid=id();
 const kind=service?'enquiry':'order';const d={kind,name:b.name.trim(),phone:b.phone.trim(),address:service?'':b.address.trim(),notes:service?String(b.notes||'').trim():'',items,subtotal,delivery,total};
 db.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(oid,s.id,'New',JSON.stringify(d),new Date().toISOString());
 const message=`${service?'Service enquiry':'Order'} #${oid.slice(0,8)} — ${s.details.name}\n${items.map(i=>`${i.name}${i.size?' / '+i.size:''}${i.color?' / '+i.color:''} × ${i.quantity}: PKR ${i.price*i.quantity}`).join('\n')}\n${service?`Indicative estimate: PKR ${total}\nPlease confirm scope, availability and final pricing. This enquiry is not a confirmed booking or payment.`:`Delivery: PKR ${delivery}\nTotal: PKR ${total}\nPayment: Cash on Delivery`}\nName: ${d.name}\nPhone: ${d.phone}\n${service?'Requirements: '+d.notes:'Address: '+d.address}`;
 return {id:oid,total,kind,whatsapp:`https://wa.me/${s.details.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`};
}
fail('Not found.',404);
}
const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pageHtml(path){let html=readFileSync(join('public','index.html'),'utf8');if(!path.startsWith('/s/'))return html;const row=db.prepare('SELECT * FROM stores WHERE slug=?').get(path.split('/')[2]);if(!row||row.status!=='approved')return html.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>');const store=liveVersion(parse(row)),d=store.details,title=(d.seoTitle||d.name+' — Online store').slice(0,160),description=(d.seoDescription||d.description||'Shop our collection. Order on WhatsApp with cash on delivery.').slice(0,320);html=html.replace(/<title>.*?<\/title>/,()=>'<title>'+htmlEscape(title)+'</title>').replace(/<meta name="description"[^>]*>/,()=>'<meta name="description" content="'+htmlEscape(description)+'">');let meta='<meta property="og:type" content="website"><meta property="og:title" content="'+htmlEscape(title)+'"><meta property="og:description" content="'+htmlEscape(description)+'">';let origin='';try{origin=appUrl();}catch{}if(origin)meta+='<link rel="canonical" href="'+htmlEscape(origin+'/s/'+store.slug)+'"><meta property="og:url" content="'+htmlEscape(origin+'/s/'+store.slug)+'">';const image=d.shareImage||d.banner;if(image&&(image.startsWith('https://')||origin))meta+='<meta property="og:image" content="'+htmlEscape(image.startsWith('/')?origin+image:image)+'">';if(d.favicon){html=html.replace('<link rel="icon" type="image/svg+xml" href="/brand-mark.svg">','');meta+='<link rel="icon" href="'+htmlEscape(d.favicon)+'">';}return html.replace('</head>',meta+'</head>');}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=15552000');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");try{let url;try{url=new URL(req.url,'http://localhost');}catch{fail('Invalid request URL.');}if(url.pathname.startsWith('/api/')){res.setHeader('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.origin;if(req.headers['sec-fetch-site']==='cross-site')fail('Invalid request origin.',403);if(origin){let valid=false;try{valid=new URL(origin).host===req.headers.host;}catch{}if(!valid)fail('Invalid request origin.',403);}if(!(req.headers['content-type']||'').startsWith('application/json'))fail('JSON content required.',415);}const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>3000000)fail('Request is too large.',413);chunks.push(c)}const raw=Buffer.concat(chunks).toString('utf8');let b={};if(raw){try{b=JSON.parse(raw)}catch{fail('Invalid JSON.')}}if(!b||typeof b!=='object'||Array.isArray(b))fail('JSON must contain an object.');const result=await api(req,res,url.pathname,b);if(result?.downloadFile){res.setHeader('Content-Type','application/gzip');res.setHeader('Content-Disposition','attachment; filename="'+result.downloadFile.split('/').pop()+'"');await pipeline(createReadStream(result.downloadFile),res);return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}if(!['GET','HEAD'].includes(req.method))fail('Method not allowed.',405);if(/^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(url.pathname)){try{const content=readFileSync(join(dir,url.pathname.slice(1)));res.setHeader('Content-Type',url.pathname.endsWith('.png')?'image/png':url.pathname.endsWith('.jpg')?'image/jpeg':'image/webp');res.setHeader('Cache-Control','public,max-age=31536000,immutable');res.end(content);return;}catch{fail('Image not found.',404)}}if(/^\/stock\/[a-z0-9-]+\.webp$/.test(url.pathname)){res.setHeader('Content-Type','image/webp');res.setHeader('Cache-Control','public,max-age=86400');res.end(readFileSync(join('public',url.pathname)));return;}const asset=['/app.js','/style.css','/themes.js','/catalog.js','/kit.js','/qrcode.js','/premium.css','/stock-manifest.js','/store-mode.js','/store-renderer.js','/samples.js','/brand-mark.svg','/brand-lockup.svg'].includes(url.pathname)?url.pathname:'/index.html';res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[extname(asset)]);res.end(asset==='/index.html'?pageHtml(url.pathname):readFileSync(join('public',asset)));}catch(e){if(res.headersSent){res.destroy();return;}res.statusCode=e.status||500;if(e.retryAfter)res.setHeader('Retry-After',String(e.retryAfter));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.status?e.message:'Something went wrong. Please try again.'}));if(!e.status)console.error('Unexpected request failure.');}});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Digital Dukan running on port ${process.env.PORT||3000}`));

server.headersTimeout=15000;server.requestTimeout=30000;server.keepAliveTimeout=5000;
if(process.env.AUTO_BACKUPS!=='false'){
 const scheduled=()=>{const latest=listBackups(dir)[0];if(!latest||Date.now()-new Date(latest.created).getTime()>=86400000)runBackup().catch(()=>console.error('Automatic backup failed; check admin backup status.'));};
 setTimeout(scheduled,60000).unref();setInterval(scheduled,3600000).unref();
}

let stopping=false;function shutdown(){if(stopping)return;stopping=true;setTimeout(()=>process.exit(0),15000).unref();server.close(()=>Promise.allSettled([...outgoingMail]).then(()=>{db.close();process.exit(0)}));}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
