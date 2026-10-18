import {DatabaseSync} from 'node:sqlite';
import {businessDetails} from '../test/fixtures.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = mkdtempSync(join(tmpdir(), 'dukan-browser-'));
const base = 'http://127.0.0.1:3471';
const password = 'Session-test-password-123';
let server, browser;

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: '3471', DATA_DIR: dir, NODE_ENV: 'test', EMAIL_VERIFICATION_ENABLED: 'true', EMAIL_TRANSPORT: 'test', APP_URL: base, AUTO_BACKUPS: 'false',
      ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    server.once('exit', () => { clearTimeout(timer); reject(new Error('Server failed to start')); });
  });
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
});

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) await new Promise(resolve => {
    server.once('exit', resolve); server.kill();
  });
  rmSync(dir, { recursive: true, force: true });
});

async function uploadProductPhoto(page){await page.locator('[data-upload-target=images]').setInputFiles({name:'sample-product.webp',mimeType:'image/webp',buffer:readFileSync('public/stock/product-tshirt.webp')});await page.waitForFunction(()=>document.querySelector('#product-form [name=images]').value.startsWith('/uploads/'));}

async function completeBusinessFields(page){for(const [key,value]of Object.entries(businessDetails)){const field=page.locator(`#signup-form [name="${key}"]`);if(await field.count()&&key!=='category'&&!await field.inputValue())await field.fill(value);}}

async function assertGuest(page) {
  await page.goto(base);
  await page.locator('.nav-actions a[href="/login"]').waitFor();
  assert.equal(await page.locator('#home-signup-form').count(), 1);
  await page.goto(base + '/login');
  await page.locator('#login-form').waitFor();
  assert.equal(new URL(page.url()).pathname, '/login');
}

async function assertSignedIn(page, path, label) {
  await page.goto(base);
  await page.locator(`.nav-actions a[href="${path}"]`).waitFor();
  assert.equal(await page.locator('.nav-actions a[href="/login"]').count(), 0);
  assert.equal(await page.locator('#home-signup-form').count(), 0);
  assert.match(await page.locator('.nav-actions').innerText(), new RegExp(label));
  assert.equal(await page.locator('a[href="/signup"]').count(), 0);
  await page.reload();
  await page.locator(`.nav-actions a[href="${path}"]`).waitFor();
  for (const route of ['/login', '/signup']) {
    await page.goto(base + route);
    await page.waitForURL(base + path);
    await page.locator('.workspace-main').waitFor();
  }
}

test('owner session persists across homepage, reload, new tab, login and signup routes', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await assertGuest(page);
  const response = await context.request.post(base + '/api/signup', { data: {
    email: 'owner@example.com', password, slug: 'session-shop', subscribed: true,
    details:{...businessDetails, name: 'Session Shop', whatsapp: '923001234567', delivery: 200 },
    sections: [{ type: 'hero', layout: 1 }, { type: 'featured', layout: 1 }],
  }});
  assert.equal(response.status(), 200);
  await assertSignedIn(page, '/dashboard', 'Dashboard');
  const secondTab = await context.newPage();
  await assertSignedIn(secondTab, '/dashboard', 'Dashboard');
  await page.goto(base);
  await page.locator('[data-action="language"]').click();
  await page.getByRole('link', { name: 'Mera dashboard', exact: true }).waitFor();
  await page.locator('[data-action="logout"]').click();
  await page.waitForURL(base + '/');
  await page.locator('.nav-actions a[href="/login"]').waitFor();
  await assertGuest(secondTab);
  await context.close();
});

test('admin gets admin navigation and redirects; revoked sessions return to guest state', async () => {
  const context = await browser.newContext();
  const response = await context.request.post(base + '/api/login', {
    data: { email: 'admin@example.com', password },
  });
  assert.equal(response.status(), 200);
  const page = await context.newPage();
  await assertSignedIn(page, '/admin', 'Admin panel');
  const logout = await context.request.post(base + '/api/logout', { data: {} });
  assert.equal(logout.status(), 200);
  await assertGuest(page);
  await page.goto(base + '/admin');
  await page.waitForURL(base + '/login');
  await page.locator('#login-form').waitFor();
  await context.close();
});


test('signup and editor previews show real layouts and persist a preview selection', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto(base+'/signup');
  await page.locator('[name=email]').fill('layouts@example.com');
  await page.locator('[name=password]').fill(password);
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('[name=slug]').fill('layout-shop');
  await page.locator('[name=name]').fill('Layout Shop');
  await page.locator('[name=whatsapp]').fill('923001234567');await completeBusinessFields(page);
  await page.locator('[name=instagram]').fill('insta.com/abc');
  await page.locator('[name=facebook]').fill('facebook.com/layoutshop');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('.preview-canvas .store-hero').first().waitFor({state:'attached'});
  assert.equal(await page.locator('.layout-choice').count(),40);
  const featured=page.locator('[data-section-type=featured]');
  const columnCounts=await featured.locator('.store-product-grid').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length));
  assert.deepEqual(columnCounts,[3,2,4,3,2]);
  const hero=page.locator('[data-section-type=hero]');
  const heroColumns=await hero.locator('.store-hero').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length));
  assert.deepEqual(heroColumns,[2,1,2,2,2]);
  assert.equal(await hero.locator('.store-layout-4').evaluate(el=>getComputedStyle(el).display),'block');
  await hero.locator('[data-preview-layout="3"]').click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(),/Photo first/);
  await page.getByRole('button',{name:'Use this layout'}).click();
  assert.equal(await hero.locator('[name=layout-hero][value="3"]').isChecked(),true);
  assert.equal(await hero.locator('.layout-selected:visible').count(),1);
  await page.setViewportSize({width:390,height:844});
  const mobileColumns=await featured.locator('.store-product-grid').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length));
  assert.deepEqual(mobileColumns,[3,2,4,3,2]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/digitaldukan-section-previews-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('[name=subscribed]').check();
  await page.getByRole('button',{name:'Subscribe'}).click();
  await page.waitForURL(base+'/dashboard');
  await page.getByRole('button',{name:'Store editor',exact:false}).click();
  await page.locator('[data-section-type=hero]').waitFor();
  assert.equal(await page.locator('[name=layout-hero][value="3"]').isChecked(),true);
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-section-type=hero] [data-preview-layout="2"]').click();
  await page.getByRole('button',{name:'Use this layout'}).click();
  const saved=page.waitForResponse(r=>r.url()===base+'/api/store'&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Save homepage'}).click();
  assert.equal((await saved).status(),200);
  await page.locator('[name=layout-hero][value="2"]:checked').waitFor();
  await page.screenshot({path:'/tmp/digitaldukan-section-previews.png',fullPage:true});
  const session=await (await context.request.get(base+'/api/session')).json();
  assert.equal(session.store.sections.find(x=>x.type==='hero').layout,2);
  assert.equal(session.store.details.instagram,'https://insta.com/abc');
  assert.equal(session.store.details.facebook,'https://facebook.com/layoutshop');
  await page.getByRole('button',{name:'Store details',exact:false}).click();
  assert.equal(await page.locator('[name=website]').count(),0);await page.locator('[name=instagram]').fill('insta.com/updated');
  const detailsSaved=page.waitForResponse(r=>r.url()===base+'/api/store'&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Save store details'}).click();
  assert.equal((await detailsSaved).status(),200);
  await page.waitForFunction(()=>document.querySelector('[name=instagram]')?.value==='https://insta.com/updated');
  assert.equal(await page.locator('[name=instagram]').inputValue(),'https://insta.com/updated');
  await page.goto(base+'/s/layout-shop');
  await page.locator('.store-hero.store-layout-2').waitFor();
  assert.equal(await page.getByRole('link',{name:'instagram',exact:false}).getAttribute('href'),'https://insta.com/updated');
  assert.deepEqual(errors,[]);
  await context.close();
});

test('blocked forms show temporary top errors for validation, server and connection failures', async () => {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto(base+'/login');
 await page.locator('#login-form').waitFor();
 await page.clock.install();
 await page.getByRole('button',{name:'Sign in',exact:false}).click();
 await page.locator('#toast.error.show').waitFor();
 assert.match(await page.locator('.toast-message').innerText(),/Email address/);
 const box=await page.locator('#toast').boundingBox();assert.ok(box.y>=0&&box.y<50);
 await page.clock.runFor(1);
 await page.locator('[name=email]').fill('owner@example.com');
 await page.locator('[name=password]').fill('Incorrect-password');
 await page.getByRole('button',{name:'Sign in',exact:false}).click();
 await page.waitForFunction(()=>document.querySelector('.toast-message').textContent==='Email or password is incorrect.');
 assert.equal(await page.locator('#toast').getAttribute('role'),'alert');
 assert.match(await page.locator('.form-error').innerText(),/Email or password is incorrect/);
 await page.clock.fastForward(4000);
 await page.route(base+'/api/login',route=>route.abort('failed'));
 await page.getByRole('button',{name:'Sign in',exact:false}).click();
 await page.waitForFunction(()=>document.querySelector('.toast-message').textContent.startsWith('Unable to connect.'));
 await page.clock.fastForward(3000);
 assert.equal(await page.locator('#toast.error.show').count(),1,'previous notification timer cannot hide the newer error');
 await page.clock.fastForward(3501);
 assert.equal(await page.locator('#toast.show').count(),0,'error auto-dismisses after 6.5 seconds');
 await page.unroute(base+'/api/login');
 await page.route(base+'/api/login',route=>route.fulfill({status:502,contentType:'text/html',body:'Bad gateway'}));
 await page.getByRole('button',{name:'Sign in',exact:false}).click();
 await page.waitForFunction(()=>document.querySelector('.toast-message').textContent.includes('unexpected response'));
 await page.getByRole('button',{name:'Dismiss notification'}).click();
 assert.equal(await page.locator('#toast.show').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await context.close();
});

test('email verification and password reset work through the public account pages', async () => {
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(base+'/login');await page.getByRole('link',{name:'Forgot password?'}).click();
 await page.locator('[name=email]').fill('owner@example.com');
 await page.getByRole('button',{name:'Send reset link'}).click();
 await page.locator('h2:has-text("Check your email")').waitFor();
 const messages=()=>readdirSync(join(dir,'test-outbox')).map(name=>JSON.parse(readFileSync(join(dir,'test-outbox',name),'utf8')));
 const reset=messages().find(m=>m.to==='owner@example.com'&&m.kind==='reset');assert.ok(reset);
 await page.goto(reset.url);await page.locator('#reset-form').waitFor();
 assert.equal(new URL(page.url()).hash,'','reset token is removed from the browser address');
 await page.locator('[name=password]').fill('New-browser-owner-456');await page.locator('[name=confirm]').fill('Mismatch-password');
 await page.getByRole('button',{name:'Reset password'}).click();await page.locator('#toast.error.show').waitFor();
 assert.match(await page.locator('.toast-message').innerText(),/do not match/);
 await page.locator('[name=confirm]').fill('New-browser-owner-456');await page.getByRole('button',{name:'Reset password'}).click();
 await page.locator('h2:has-text("Password updated")').waitFor();
 await page.getByRole('link',{name:'Sign in',exact:false}).click();await page.locator('#login-form').waitFor();
 await page.locator('[name=email]').fill('owner@example.com');await page.locator('[name=password]').fill('New-browser-owner-456');
 await page.getByRole('button',{name:'Sign in',exact:false}).click();await page.waitForURL(base+'/dashboard');
 const sent=page.waitForResponse(r=>r.url()===base+'/api/auth/resend-verification');
 await page.getByRole('button',{name:'Send verification email'}).click();assert.equal((await sent).status(),200);
 const verification=messages().filter(m=>m.to==='owner@example.com'&&m.kind==='verify').at(-1);assert.ok(verification);
 await page.goto(verification.url);await page.locator('#verify-form').waitFor();
 assert.equal(new URL(page.url()).hash,'');
 await page.getByRole('button',{name:'Verify my email'}).click();await page.locator('h2:has-text("Email verified")').waitFor();
 await page.getByRole('link',{name:'Open dashboard'}).click();await page.locator('.workspace-main').waitFor();
 assert.equal(await page.locator('.verification-notice').count(),0);
 await context.close();
});

test('admin can create and download an archive from the backup panel',async()=>{
 const context=await browser.newContext();
 const response=await context.request.post(base+'/api/login',{data:{email:'admin@example.com',password}});assert.equal(response.status(),200);
 const page=await context.newPage();await page.goto(base+'/admin');
 await page.locator('[data-admin-tab=backups]').click();
 await page.getByRole('button',{name:'Create backup'}).click();
 await page.locator('a[download]').first().waitFor();
 const downloadPromise=page.waitForEvent('download');await page.locator('a[download]').first().click();
 const download=await downloadPromise;assert.match(download.suggestedFilename(),/^dukan-.*\.tar\.gz$/);assert.equal(await download.failure(),null);
 await context.close();
});

test('admin owner account form corrects email and password and the owner can sign in again',async()=>{
 const context=await browser.newContext();
 const response=await context.request.post(base+'/api/login',{data:{email:'admin@example.com',password}});assert.equal(response.status(),200);
 const page=await context.newPage();await page.goto(base+'/admin');
 const row=page.locator('.admin-store').filter({hasText:'owner@example.com'});
 await row.locator('[data-owner-account]').click();
 await page.locator('#owner-account-form').waitFor();
 await page.locator('[name=email]').fill('browser-recovered@example.com');
 await page.locator('[name=newPassword]').fill('New-browser-recovered-789');
 await page.locator('[name=confirmPassword]').fill('New-browser-recovered-789');
 await page.locator('[name=adminPassword]').fill('Incorrect-admin-password');
 await page.getByRole('button',{name:'Save owner account'}).click();
 await page.waitForFunction(()=>document.querySelector('#owner-account-form .form-error')?.textContent.includes('admin password is incorrect'));
 await page.locator('[name=adminPassword]').fill(password);
 await page.getByRole('button',{name:'Save owner account'}).click();
 await page.locator('.admin-store').filter({hasText:'browser-recovered@example.com'}).waitFor();
 assert.equal(await page.locator('#owner-account-form').count(),0);
 await page.locator('[data-action=logout]').click();await page.waitForURL(base+'/');
 await page.goto(base+'/login');await page.locator('[name=email]').fill('browser-recovered@example.com');
 await page.locator('[name=password]').fill('New-browser-recovered-789');await page.getByRole('button',{name:'Sign in',exact:false}).click();
 await page.waitForURL(base+'/dashboard');await page.locator('.verification-notice').waitFor();
 await context.close();
});

test('niche signup suggests local themes, keeps customization and saves the chosen storefront style',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/signup');await page.locator('[name=email]').fill('niche-browser@example.com');await page.locator('[name=password]').fill(password);
 await page.getByRole('button',{name:'Continue'}).click();
 await page.locator('[name=slug]').fill('niche-browser');await page.locator('[name=name]').fill('Niche Shop');await page.locator('[name=whatsapp]').fill('923001234567');await completeBusinessFields(page);
 const themeRequests=[];page.on('request',r=>{if(r.url().startsWith(base+'/api/'))themeRequests.push(r.url())});
 await page.locator('[name=category]').selectOption('Electronics');assert.equal(await page.locator('[name=theme]').inputValue(),'electronics');
 await page.locator('[name=niche]').fill('skincare');await page.waitForFunction(()=>document.querySelector('[name=theme]').value==='beauty');
 await page.locator('[name=accent]').evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.locator('[name=niche]').fill('bakery');await page.waitForFunction(()=>document.querySelector('[name=theme]').value==='bakery');
 assert.equal(await page.locator('[name=accent]').inputValue(),'#123456');assert.deepEqual(themeRequests,[],'recommendations do not make backend or AI requests');
 await page.getByRole('button',{name:'Continue'}).click();
 await page.locator('[data-section-type=hero]').waitFor();assert.equal(await page.locator('[name=layout-hero][value="3"]').isChecked(),true);
 assert.ok(await page.locator('.recommended-badge').count()>0);
 assert.match(await page.locator('[data-section-type=featured] .preview-canvas').first().innerText(),/Celebration cake/);
 await page.locator('[name=layout-hero][value="1"]').check();await page.getByRole('button',{name:'Continue'}).click();
 await page.locator('[data-action=signup-back]').click();await page.locator('[data-action=signup-back]').click();
 await page.locator('[name=niche]').fill('skincare');await page.waitForFunction(()=>document.querySelector('[name=theme]').value==='beauty');
 await page.getByRole('button',{name:'Continue'}).click();assert.equal(await page.locator('[name=layout-hero][value="1"]').isChecked(),true,'manual sections survive niche changes');
 await page.locator('[data-action=suggest-sections]').click();assert.equal(await page.locator('[name=layout-hero][value="2"]').isChecked(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/digitaldukan-niche-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Continue'}).click();await page.locator('[name=subscribed]').check();await page.getByRole('button',{name:'Subscribe'}).click();await page.waitForURL(base+'/dashboard');
 let stored=await(await context.request.get(base+'/api/session')).json();assert.equal(stored.store.details.theme,'beauty');assert.equal(stored.store.details.accent,'#123456');
 await page.getByRole('button',{name:'Store details',exact:false}).click();await page.locator('[name=theme]').selectOption('electronics');
 const saved=page.waitForResponse(r=>r.url()===base+'/api/store'&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Save store details'}).click();assert.equal((await saved).status(),200);
 await page.locator('.sidebar [data-tab=products]').click();await page.getByRole('button',{name:'Add product',exact:false}).click();
 await page.locator('[name=name]').fill('Wireless headphones');await page.locator('[name=price]').fill('2400');await page.locator('[name=category]').fill('Electronics');await page.locator('[name=category]').blur();
 await uploadProductPhoto(page);await page.getByRole('button',{name:'Save product'}).click();await page.locator('td:has-text("Wireless headphones")').waitFor();
 await page.goto(base+'/s/niche-browser');await page.locator('.storefront[data-theme=electronics]').waitFor();
 assert.match(await page.locator('.store-hero h1').innerText(),/everyday upgrade/);await page.locator('.store-product .product-media img').waitFor();
 const color=await page.locator('.storefront').evaluate(el=>getComputedStyle(el).getPropertyValue('--brand').trim());assert.equal(color,'#123456');
 await page.screenshot({path:'/tmp/digitaldukan-niche-store.png',fullPage:true});
 await page.goto(base+'/dashboard');await page.getByRole('button',{name:'Store editor',exact:false}).click();
 await page.locator('#studio-preview-canvas h1').fill('Owner custom heading');await page.locator('#studio-preview-canvas h1').blur();await page.locator('[name=layout-hero][value="3"]').check();
 await page.locator('[data-action=suggest-sections]').click();assert.equal(await page.locator('[name=layout-hero][value="2"]').isChecked(),true);
 assert.equal(await page.locator('[name=title-hero]').inputValue(),'Owner custom heading');
 const recipeSaved=page.waitForResponse(r=>r.url()===base+'/api/store'&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Save homepage'}).click();assert.equal((await recipeSaved).status(),200);
 stored=await(await context.request.get(base+'/api/session')).json();assert.equal(stored.store.sections.find(s=>s.type==='hero').title,'Owner custom heading');assert.equal(stored.store.details.accent,'#123456');
 assert.deepEqual(errors,[]);await context.close();
});

test('premium studio supports complete recipes, section photos, live edits, undo and explicit publishing',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Cached category photos are used locally. Any fallback external request is isolated here.
 const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNmcAAAAASUVORK5CYII=','base64');
 await context.route('https://images.unsplash.com/**',route=>route.fulfill({contentType:'image/png',body:fixture}));
 await page.goto(base+'/templates');await page.locator('.gallery-card').first().waitFor();assert.equal(await page.locator('.gallery-card').count(),30);
 await page.locator('#gallery-search').fill('bakery');assert.equal(await page.locator('.gallery-card:visible').count(),1);await page.getByRole('link',{name:'Start with this theme'}).filter({visible:true}).click();
 await page.locator('[name=email]').fill('premium-studio@example.com');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Continue'}).click();assert.equal(await page.locator('[name=theme]').inputValue(),'bakery');
 await page.locator('[name=name]').fill('Crumb Studio');await page.locator('[name=slug]').fill('premium-studio');await page.locator('[name=whatsapp]').fill('923001234567');await completeBusinessFields(page);await page.getByRole('button',{name:'Continue'}).click();
 await page.locator('[data-recipe="3"]').click();await page.getByRole('dialog').waitFor();assert.ok(await page.locator('.modal .store-layout-4').count()>1);await page.getByRole('button',{name:'Use this homepage'}).click();assert.equal(await page.locator('[name=layout-hero][value="4"]').isChecked(),true);assert.equal(await page.locator('.layout-choice').count(),40);
 await page.getByRole('button',{name:'Continue'}).click();await page.locator('[name=subscribed]').check();await page.getByRole('button',{name:'Subscribe'}).click();await page.waitForURL(base+'/dashboard',{timeout:10000}).catch(async error=>{throw new Error((await page.locator('.form-error').innerText())||error.message)});await page.locator('.launch-checklist').waitFor();
 await page.getByRole('button',{name:'Store editor',exact:false}).click();await page.locator('#studio-preview-canvas .store-hero').waitFor();
 await page.locator('#studio-preview-canvas h1').fill('Fresh from our oven');await page.locator('#studio-preview-canvas h1').blur();await page.waitForFunction(()=>document.querySelector('#studio-preview-canvas h1')?.textContent==='Fresh from our oven');
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.locator('[name=title-hero]').inputValue(),'');await page.locator('#studio-preview-canvas h1').fill('Fresh from our oven');await page.locator('#studio-preview-canvas h1').blur();
 await page.locator('#studio-preview-canvas h1').fill('Edited on the canvas');await page.locator('#studio-preview-canvas h1').press('Tab');assert.equal(await page.locator('[name=title-hero]').inputValue(),'Edited on the canvas');await page.locator('[data-section-photo=hero]').click();await page.locator('#section-photo-form [name=imagePosition]').selectOption('top');await page.locator('#section-photo-form [name=mobileImagePosition]').selectOption('bottom');await page.getByRole('button',{name:'Apply image',exact:true}).click();await page.locator('[data-section-photo=hero]').click();await page.locator('[data-stock-for=hero]').click();await page.locator('#stock-search').fill('bakery');assert.ok(await page.locator('[data-photo-url]:visible').count()>1);await page.locator('[data-photo-url="/stock/bakery.webp"]').click();
 assert.match(await page.locator('[name=image-hero]').inputValue(),/^\/stock\/bakery\.webp$/);await page.locator('[data-device=mobile]').click();await page.waitForTimeout(200);assert.equal(await page.locator('.studio-preview-wrap.mobile-preview').count(),1);assert.equal(await page.locator('#studio-preview-canvas .store-hero>.kit-media img').evaluate(el=>getComputedStyle(el).objectPosition),'50% 100%');
 await page.getByRole('button',{name:'Publish changes',exact:true}).click();assert.match(await page.locator('#toast.error').innerText(),/Save your changes/);
 const saved=page.waitForResponse(r=>r.url()===base+'/api/store'&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Save homepage'}).click();assert.equal((await saved).status(),200);await page.locator('#studio-save-state').waitFor();
 await page.locator('[data-section-photo=hero]').click();await page.locator('[data-clear-photo=hero]').click();await page.getByRole('button',{name:'Save homepage'}).click();await page.locator('#studio-save-state').waitFor();assert.equal((await(await context.request.get(base+'/api/session')).json()).store.sections.find(s=>s.type==='hero').image,'','cleared photos stay cleared after saving');
 await page.locator('.sidebar [data-tab=products]').click();await page.getByRole('button',{name:'Add product',exact:false}).click();await page.locator('[name=name]').fill('Cookie box');await page.locator('[name=price]').fill('900');await uploadProductPhoto(page);await page.getByRole('button',{name:'Save product'}).click();await page.locator('td:has-text("Cookie box")').waitFor();
 await page.getByRole('button',{name:'Store details',exact:false}).click();const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1000;canvas.getContext('2d').fillRect(0,0,2000,1000);return canvas.toDataURL('image/png').split(',')[1]});
 await page.locator('[data-upload-target=banner]').setInputFiles({name:'test-banner.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.waitForFunction(()=>document.querySelector('[name=banner]').value.startsWith('/uploads/'));const uploaded=await page.locator('[name=banner]').inputValue();const dimensions=await page.evaluate(async url=>{const bitmap=await createImageBitmap(await(await fetch(url)).blob());return [bitmap.width,bitmap.height]},uploaded);assert.deepEqual(dimensions,[1600,800]);
 await page.locator('.seo-settings summary').click();await page.locator('[name=seoTitle]').fill('Crumb Studio — Fresh bakes');await page.getByRole('button',{name:'Save store details'}).click();await page.locator('#settings-form').waitFor();
 await page.getByRole('button',{name:'Publish changes',exact:true}).click();await page.locator('#toast').filter({hasText:'Design published'}).waitFor();
 await page.getByRole('button',{name:'Overview',exact:false}).click();await page.getByRole('button',{name:'Share link & QR code'}).click();await page.locator('#store-qr svg').waitFor();assert.ok((await page.locator('#store-qr svg path').getAttribute('d')).length>100);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await context.close();
});

test('all five kit compositions render desktop and mobile without overflow or broken section structure',async()=>{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://images.unsplash.com/**',route=>route.abort());
 for(const layout of [1,2,3,4,5])for(const width of [1440,390]){
  await page.setViewportSize({width,height:960});await page.goto(base+'/demo?kit=fashion&layout='+layout);await page.locator('.storefront').waitFor();
  assert.equal(await page.locator('.store-hero .store-hero-copy').count(),1);assert.equal(await page.locator('.store-hero>.kit-media img').count(),1);assert.ok(await page.locator('.storefront [data-section=contact]').count());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`layout ${layout}, width ${width}`);
  assert.ok(await page.locator('.store-hero h1').evaluate(el=>el.getBoundingClientRect().height>30));
 }
 assert.deepEqual(errors,[]);await context.close();
});

test('all 30 category photographs decode locally without external image requests',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const external=[];
 page.on('request',r=>{if(/^https:/.test(r.url()))external.push(r.url());});await context.route('https://**',route=>route.abort());
 await page.goto(base+'/templates');await page.locator('.gallery-card').first().waitFor();
 const photos=await page.locator('.gallery-card>img').evaluateAll(async images=>{images.forEach(image=>image.loading='eager');return await Promise.all(images.map(async image=>{await image.decode();return {src:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight};}));});
 assert.equal(photos.length,30);for(const photo of photos){assert.match(photo.src,/^\/stock\/[a-z]+\.webp$/);assert.ok(photo.width>=1000&&photo.height>100);const response=await context.request.get(base+photo.src);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/webp/);assert.equal(response.headers()['cache-control'],'public,max-age=86400');}assert.deepEqual(external,[]);
 await page.screenshot({path:'docs/screenshots/template-gallery.png'});
 await page.goto(base+'/demo?kit=fashion&layout=4');await page.locator('.store-hero .kit-media img').evaluate(img=>img.decode());await page.screenshot({path:'docs/screenshots/fashion-kit-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/screenshots/fashion-kit-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
});

test('product semantics, category filtering and uniform card geometry survive all five layouts',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const signup=await context.request.post(base+'/api/signup',{data:{email:'consistent-cards@example.com',password,slug:'consistent-cards',subscribed:true,details:{...businessDetails,name:'Card Studio',theme:'fashion',whatsapp:'923001234567',delivery:200,businessMode:'retail'},sections:[{type:'categories',layout:5},{type:'featured',layout:5,text:'A collection introduction.'}]}});assert.equal(signup.status(),200,await signup.text());
 for(const product of [{name:'Short name',description:'Original product description.',price:1800,images:['/stock/product-tshirt.webp'],category:'Clothing'},{name:'A deliberately longer product name that wraps onto two lines',description:'A detailed product description. '.repeat(15),price:2500,salePrice:2200,stock:0,images:['/stock/product-shirt.webp','/stock/product-tshirt.webp'],category:'Clothing'},{name:'Denim jeans',description:'',price:3200,images:['/stock/product-jeans.webp'],sizes:'S, M, L',colors:'Blue, Black',category:'Denim'},{name:'Product awaiting a photo',price:900,category:'Accessories',images:[]}]){if(product.images.length)assert.equal((await context.request.post(base+'/api/products',{data:product})).status(),200);else{const account=await(await context.request.get(base+'/api/session')).json(),db=new DatabaseSync(join(dir,'digitaldukan.sqlite'));try{db.prepare('INSERT INTO products VALUES(?,?,?)').run('cccccccccccccccccccccccc',account.store.id,JSON.stringify({...product,sizes:'',colors:'',stock:null,salePrice:null}));}finally{db.close()}}} // Legacy photo-free products remain viewable; new submissions require a photo.
 let sessionData=await(await context.request.get(base+'/api/session')).json();
 for(const layout of [1,2,3,4,5]){
  assert.equal((await context.request.patch(base+'/api/store',{data:{details:sessionData.store.details,sections:[{type:'categories',layout:5},{type:'featured',layout,text:'A collection introduction.'},{type:'about',layout:4}]}})).status(),200);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/s/consistent-cards');await page.locator('.store-product').first().waitFor();
   assert.equal(await page.locator('#store-products>.section-intro').innerText(),'A collection introduction.');assert.equal(await page.locator('.store-product .product-description').first().innerText(),'Original product description.');
   const dimensions=await page.locator('.store-product').evaluateAll(cards=>cards.map(c=>({height:c.getBoundingClientRect().height,media:c.querySelector('.product-media').getBoundingClientRect().height,buttonOffset:c.querySelector('.product-cart-button').getBoundingClientRect().bottom-c.getBoundingClientRect().bottom})));
   assert.ok(Math.max(...dimensions.map(c=>c.height))-Math.min(...dimensions.map(c=>c.height))<2,`card height differs, layout ${layout}, width ${width}: ${JSON.stringify(dimensions)}`);
   assert.ok(Math.max(...dimensions.map(c=>c.media))-Math.min(...dimensions.map(c=>c.media))<2,`image area differs, layout ${layout}, width ${width}`);
   assert.ok(await page.locator('.product-media>img').evaluateAll(images=>images.every(image=>{const r=image.getBoundingClientRect(),box=image.parentElement.getBoundingClientRect();return r.height<=box.height+1&&r.width<=box.width+1&&getComputedStyle(image).objectFit==='contain';})), 'portrait images must fit inside the media area');
   assert.ok(Math.max(...dimensions.map(c=>c.buttonOffset))-Math.min(...dimensions.map(c=>c.buttonOffset))<2,'action baselines differ');
   const clear=await page.evaluate(()=>document.querySelector('#store-products').getBoundingClientRect().top>=document.querySelector('[data-section=categories]').getBoundingClientRect().bottom);assert.ok(clear,'category artwork must not overlap products');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-filter-category=Denim]').click();assert.equal(await page.locator('.store-product:visible').count(),1);assert.equal(await page.locator('.store-product:visible h3').innerText(),'Denim jeans');await page.getByRole('button',{name:'Show all',exact:true}).click();assert.equal(await page.locator('.store-product:visible').count(),4);
 const card=page.locator('.store-product').filter({hasText:'A deliberately longer product name'});await card.locator('[data-photo-index="1"]').click();assert.match(await card.locator('.product-media img').getAttribute('src'),/product-tshirt/);await card.locator('[data-product-details]').click();await page.getByRole('dialog').waitFor();assert.match(await page.locator('.product-details-modal').innerText(),/A detailed product description/);await page.getByRole('button',{name:'Close',exact:true}).click();
 assert.equal(await page.locator('.store-product').filter({hasText:'Product awaiting a photo'}).locator('.product-photo-placeholder').count(),1);assert.deepEqual(errors,[]);await context.close();
});

test('recipe previews use the same matching product catalogue as section thumbnails; platform logo is applied',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await page.goto(base+'/signup?kit=bakery');await page.locator('[name=email]').fill('recipe-consistency@example.com');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Continue'}).click();await page.locator('[name=slug]').fill('recipe-consistency');await page.locator('[name=name]').fill('Bakery Studio');await page.locator('[name=whatsapp]').fill('923001234567');await completeBusinessFields(page);await page.getByRole('button',{name:'Continue'}).click();
 const names=await page.locator('[data-section-type=featured] .layout-choice').first().locator('.store-product h3').allTextContents();assert.deepEqual(names,['Celebration cake','Chocolate-chip cookies','Seeded bread loaves','Chocolate dessert slices']);await page.locator('[data-recipe="4"]').click();assert.deepEqual(await page.locator('.modal .store-product h3').allTextContents(),names);assert.match(await page.locator('.modal .store-product .product-media img').first().getAttribute('src'),/product-cake/);await page.getByRole('button',{name:'Close',exact:true}).click();
 assert.equal(await page.locator('.nav .brand-symbol').getAttribute('src'),'/brand-mark.svg');const response=await context.request.get(base+'/brand-mark.svg');assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/svg\+xml/);assert.equal(await page.locator('link[rel=icon]').getAttribute('href'),'/brand-mark.svg');
 await page.goto(base+'/demo?kit=fashion&layout=4');assert.deepEqual(await page.locator('.store-product h3').allTextContents(),['White cotton T-shirt','White formal shirt','Denim jeans','Cream knitted wrap']);assert.equal(await page.locator('.store-brand .brand-symbol').count(),0,'merchant branding is separate from platform branding');await context.close();
});

test('service storefront enquiry UI has no shipping promises or address field',async()=>{
 const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/demo?kit=digital&layout=4');await page.locator('.store-product').first().waitFor();assert.match(await page.locator('.hero-shopping-notes').innerText(),/enquiries/);assert.ok(!/Cash on delivery|Delivered to you/.test(await page.locator('.store-benefits').innerText()));await page.locator('[data-add-cart]').first().click();await page.locator('[data-action=cart]').click();assert.equal(await page.locator('#checkout-form [name=address]').count(),0);assert.equal(await page.locator('#checkout-form [name=notes]').count(),1);assert.ok(!/Cash on Delivery/.test(await page.locator('#checkout-form').innerText()));assert.match(await page.locator('.cart-total').innerText(),/Indicative estimate/);await context.close();
});
