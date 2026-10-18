import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';

test('paused verification disappears from owner/admin workflows and old links explain the pause',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dukan-pause-browser-')),base='http://127.0.0.1:3488',password='Pause-browser-password-123';let server,browser;
 try{
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3488',DATA_DIR:dir,NODE_ENV:'test',EMAIL_VERIFICATION_ENABLED:'false',EMAIL_TRANSPORT:'test',APP_URL:base,AUTO_BACKUPS:'false',ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve()});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'))})});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const signup=await context.request.post(base+'/api/signup',{data:{email:'owner@example.com',password,slug:'pause-browser',subscribed:true,details:{name:'Pause Browser Shop',whatsapp:'923001234567',delivery:0},sections:[{type:'hero',layout:1}]}});assert.equal(signup.status(),200);
  await page.goto(base+'/dashboard');await page.locator('.launch-checklist').waitFor();
  assert.equal(await page.locator('.verification-notice,[data-action="resend-verification"]').count(),0);
  assert.equal(await page.getByText('Verify your account email',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Launch check',exact:true}).click();await page.getByRole('heading',{name:'Before you launch'}).waitFor();
  assert.match(await page.locator('.modal').innerText(),/Admin approval remains required/);
  assert.doesNotMatch(await page.locator('.modal').innerText(),/Verify your account email|email verification remain required/);
  await page.goto(base+'/verify-email#token='+'a'.repeat(64));await page.getByRole('heading',{name:'Email verification paused'}).waitFor();
  assert.equal(await page.locator('#verify-form').count(),0);assert.equal(new URL(page.url()).hash,'');
  const admin=await browser.newContext();await admin.request.post(base+'/api/login',{data:{email:'admin@example.com',password}});const adminPage=await admin.newPage();
  await adminPage.goto(base+'/admin');await adminPage.locator('.admin-store').waitFor();assert.doesNotMatch(await adminPage.locator('.admin-store').innerText(),/Email not verified/);
  await adminPage.getByRole('button',{name:'Owner account',exact:true}).click();await adminPage.locator('#owner-account-form').waitFor();
  assert.match(await adminPage.locator('#owner-account-form').innerText(),/Email verification is temporarily paused/);
  assert.doesNotMatch(await adminPage.locator('#owner-account-form').innerText(),/A changed email needs verification/);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();if(server?.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill()});rmSync(dir,{recursive:true,force:true})}
});
