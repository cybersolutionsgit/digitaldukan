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
