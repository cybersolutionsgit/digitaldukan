import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = mkdtempSync(join(tmpdir(), 'dukan-browser-'));
const base = 'http://127.0.0.1:3471';
const password = 'Session-test-password-123';
let server, browser;

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: '3471', DATA_DIR: dir, NODE_ENV: 'test',
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
    details: { name: 'Session Shop', whatsapp: '923001234567', delivery: 200 },
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
  await page.locator('[name=whatsapp]').fill('923001234567');
  await page.locator('[name=instagram]').fill('insta.com/abc');
  await page.locator('[name=facebook]').fill('facebook.com/layoutshop');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.locator('.preview-canvas .store-hero').first().waitFor({state:'attached'});
  assert.equal(await page.locator('.layout-choice').count(),24);
  const featured=page.locator('[data-section-type=featured]');
  const columnCounts=await featured.locator('.store-product-grid').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length));
  assert.deepEqual(columnCounts,[3,2,4]);
  const hero=page.locator('[data-section-type=hero]');
  const heroColumns=await hero.locator('.store-hero').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length));
  assert.deepEqual(heroColumns,[2,1,2]);
  await hero.locator('[data-preview-layout="3"]').click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(),/Image first/);
  await page.getByRole('button',{name:'Use this layout'}).click();
  assert.equal(await hero.locator('[name=layout-hero][value="3"]').isChecked(),true);
  assert.equal(await hero.locator('.layout-selected:visible').count(),1);
  await page.setViewportSize({width:390,height:844});
  const mobileColumns=await featured.locator('.store-product-grid').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length));
  assert.deepEqual(mobileColumns,[3,2,4]);
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
  await page.locator('[name=website]').fill('example.com/myshop');
  const detailsSaved=page.waitForResponse(r=>r.url()===base+'/api/store'&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Save store details'}).click();
  assert.equal((await detailsSaved).status(),200);
  await page.waitForFunction(()=>document.querySelector('[name=website]')?.value==='https://example.com/myshop');
  assert.equal(await page.locator('[name=website]').inputValue(),'https://example.com/myshop');
  await page.goto(base+'/s/layout-shop');
  await page.locator('.store-hero.store-layout-2').waitFor();
  assert.equal(await page.getByRole('link',{name:'instagram',exact:false}).getAttribute('href'),'https://insta.com/abc');
  assert.deepEqual(errors,[]);
  await context.close();
});
