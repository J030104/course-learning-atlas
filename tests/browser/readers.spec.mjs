import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.pdf': 'application/pdf', '.wasm': 'application/wasm',
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'atlas-readers-'));
  const out = join(root, 'dist');
  const alpha = join(root, 'alpha');
  const beta = join(root, 'beta');
  await Promise.all([cp('examples/networking', alpha, { recursive: true }),
    cp('examples/networking', beta, { recursive: true })]);
  const second = JSON.parse(await readFile(join(beta, 'course.json'), 'utf8'));
  Object.assign(second.course, { id: 'second', code: 'SECOND', title: 'Second Course' });
  await writeFile(join(beta, 'course.json'), JSON.stringify(second));
  const site = join(root, 'site.json');
  await writeFile(site, JSON.stringify({ courses: [{ config: 'alpha/course.json' }, { config: 'beta/course.json' }] }));
  const build = () => execFileSync('python3', ['atlas.py', 'build', '--site', site, '--output', out]);
  const edit = async (folder, title) => {
    const file = join(folder, 'course.json');
    const data = JSON.parse(await readFile(file, 'utf8'));
    data.course.title = title;
    await writeFile(file, JSON.stringify(data));
  };
  build();
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let file = resolve(out, '.' + pathname);
      if (!file.startsWith(out + sep) && file !== out) throw new Error('outside fixture');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      response.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: 'http://127.0.0.1:' + server.address().port, alpha, beta, build, edit,
    close: async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); },
  };
}

async function checkForUpdate(page) {
  await page.bringToFront();
  const request = page.waitForResponse(response => response.url().endsWith('/version.json'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await request;
}

test('simultaneous readers keep separate state and receive only applicable updates', async ({ browser }) => {
  const site = await fixture();
  const left = await browser.newContext();
  const right = await browser.newContext();
  try {
    const a = await left.newPage(), b = await right.newPage();
    const card = page => page.locator('.card').filter({ hasText: '容量估算講義' });
    const sheet = page => page.frameLocator('#viewer iframe');
    await Promise.all([a.goto(site.url + '/networks/'), b.goto(site.url + '/networks/')]);
    await card(a).getByRole('button', { name: '收藏：容量估算講義' }).click();
    await expect(card(b).getByRole('button', { name: '收藏：容量估算講義' })).toBeVisible();
    await Promise.all([card(a).getByText('容量估算講義', { exact: true }).click(),
      card(b).getByText('容量估算講義', { exact: true }).click()]);
    await expect(sheet(a).locator('canvas[aria-label="第 1 頁"]')).toBeVisible();
    await expect(sheet(b).locator('canvas[aria-label="第 1 頁"]')).toBeVisible();
    await sheet(a).getByRole('button', { name: '下一頁' }).click();
    await expect(sheet(a).locator('#page-number')).toHaveValue('2');
    await expect(sheet(b).locator('#page-number')).toHaveValue('1');
    const sameBrowser = await left.newPage();
    await sameBrowser.goto(site.url + '/second/');
    await expect(card(sameBrowser).getByRole('button', { name: '收藏：容量估算講義' })).toBeVisible();
    await card(sameBrowser).getByText('容量估算講義', { exact: true }).click();
    await expect(sheet(sameBrowser).locator('#page-number')).toHaveValue('1');
    await sameBrowser.close();
    await sheet(b).locator('#scroll').press('Escape');
    await b.getByLabel('切換課程').selectOption('../second/');
    await expect(b.locator('#home h1')).toHaveText('Second Course');
    await expect(card(b).getByRole('button', { name: '收藏：容量估算講義' })).toBeVisible();

    await site.edit(site.beta, 'Second Updated');
    site.build();
    await checkForUpdate(a);
    await expect(a.locator('#viewer [data-update-notice]')).toBeHidden();
    await checkForUpdate(b);
    await expect(b.locator('.topbar [data-update-notice]')).toBeVisible();
    await expect(b.locator('#home h1')).toHaveText('Second Course');
    await b.locator('.topbar [data-update-notice] button').click();
    await expect(b.locator('#home h1')).toHaveText('Second Updated');

    await Promise.all([site.edit(site.alpha, 'First Updated'), site.edit(site.beta, 'Second Updated Again')]);
    site.build();
    await checkForUpdate(a);
    await expect(a.locator('#viewer [data-update-notice]')).toBeVisible();
    await expect(sheet(a).locator('#page-number')).toHaveValue('2');
    await a.locator('#viewer [data-update-notice] button').click();
    await expect(a.locator('#home h1')).toHaveText('First Updated');
    await expect(sheet(a).locator('#page-number')).toHaveValue('2');
    await checkForUpdate(b);
    await expect(b.locator('.topbar [data-update-notice]')).toBeVisible();
  } finally {
    await Promise.all([left.close(), right.close()]);
    await site.close();
  }
});

test('standalone PDF stays open until the reader refreshes and keeps its page', async ({ page }) => {
  const site = await fixture();
  try {
    await page.goto(site.url + '/networks/pdf.html?file=resources%2Fcapacity.pdf&page=1');
    await expect(page.locator('canvas[aria-label="第 1 頁"]')).toBeVisible();
    await page.getByRole('button', { name: '下一頁' }).click();
    await expect(page.locator('#page-number')).toHaveValue('2');
    await site.edit(site.alpha, 'First Updated');
    site.build();
    await checkForUpdate(page);
    await expect(page.locator('[data-update-notice]')).toBeVisible();
    await page.locator('[data-update-notice] button').click();
    await expect(page).toHaveURL(/page=2$/);
    await expect(page.locator('canvas[aria-label="第 2 頁"]')).toBeVisible();
    await expect(page.locator('[data-update-notice]')).toBeHidden();
  } finally {
    await site.close();
  }
});
