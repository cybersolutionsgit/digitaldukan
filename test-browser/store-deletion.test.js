import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';

test('admin can cancel or confirm deletion; validation keeps the store and a successful delete refreshes the list',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dukan-delete-browser-')),base='http://127.0.0.1:3490',password='Deletion-browser-password-123';let server,browser;
 try{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3490',DATA_DIR:dir,NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'false',AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve()});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  const owner=await browser.newContext();const signup=await owner.request.post(base+'/api/signup',{data:{email:'sample-owner@example.com',password,slug:'sample-dukan',subscribed:true,details:{name:'Sample Dukan',whatsapp:'923001234567',delivery:0},sections:[{type:'hero',layout:1}]}});assert.equal(signup.status(),200);
  const admin=await browser.newContext({viewport:{width:1280,height:1000}});await admin.request.post(base+'/api/login',{data:{email:'admin@example.com',password}});const page=await admin.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin');await page.getByRole('button',{name:'Delete store',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Delete store'});await modal.waitFor();assert.match(await modal.innerText(),/products, orders and owner login/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('#delete-store-form').count(),0);assert.equal(await page.locator('.admin-store').count(),1);
  await page.getByRole('button',{name:'Delete store',exact:true}).click();
  await page.screenshot({path:'docs/screenshots/admin-delete-store.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  const bounds=await modal.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,'delete dialog fits mobile');
  await page.setViewportSize({width:1280,height:1000});
  await modal.getByLabel('Store address to confirm').fill('wrong-address');await modal.getByLabel('Your current admin password').fill(password);
  let response=page.waitForResponse(r=>r.request().method()==='DELETE');await modal.getByRole('button',{name:'Permanently delete store'}).click();assert.equal((await response).status(),400);await page.locator('#delete-store-form .form-error').filter({hasText:'Type the exact store address'}).waitFor();assert.equal(await page.locator('.admin-store').count(),1);
  await modal.getByLabel('Store address to confirm').fill('sample-dukan');await modal.getByLabel('Your current admin password').fill('wrong-password');
  response=page.waitForResponse(r=>r.request().method()==='DELETE');await modal.getByRole('button',{name:'Permanently delete store'}).click();assert.equal((await response).status(),403);await page.locator('#delete-store-form .form-error').filter({hasText:'Your admin password is incorrect'}).waitFor();
  await modal.getByLabel('Your current admin password').fill(password);
  response=page.waitForResponse(r=>r.request().method()==='DELETE');await modal.getByRole('button',{name:'Permanently delete store'}).click();assert.equal((await response).status(),200);
  await page.getByRole('heading',{name:'No stores submitted yet.'}).waitFor();assert.equal(await page.locator('#delete-store-form').count(),0);assert.equal(await page.locator('.admin-store').count(),0);
  assert.equal((await (await owner.request.get(base+'/api/session')).json()).user,null);assert.deepEqual(errors,[]);
 }finally{await browser?.close();if(server?.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill()});rmSync(dir,{recursive:true,force:true})}
});
