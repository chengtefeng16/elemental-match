// 回归检查，只读不改页面。默认测本地文件；BASE_URL=线上地址 可测线上。
// 依赖本机已安装的 Google Chrome。PROXY 用于加载 CDN 和字体。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY = process.env.PROXY ?? 'http://127.0.0.1:40009';
const WIDTH = 400;
const failures = [];

function report(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures.push(name);
}

function serveLocal() {
  const types = { '.html': 'text/html; charset=utf-8' };
  const server = http.createServer(async (req, res) => {
    const name = new URL(req.url, 'http://x').pathname.replace(/^\/$/, '/index.html');
    try {
      const body = await readFile(path.join(ROOT, path.normalize(name)));
      res.writeHead(200, { 'Content-Type': types[path.extname(name)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 800 } });
  // 检查时绝不写入真实数据表：即使 CONFIG.endpoint 已填，请求也在本地被拦下
  await context.route(/script\.google\.com/, (route) => route.fulfill({ status: 200, body: 'ok' }));
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, errors };
}

const scrollWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth);

async function homeFlow(browser, base, lang) {
  const { context, page, errors } = await newPage(browser);
  try {
    await page.goto(`${base}/?lang=${lang}#partner`, { waitUntil: 'load' });
    report(`主页 ${lang} 初始 scrollWidth=${WIDTH}`, (await scrollWidth(page)) === WIDTH, `实际 ${await scrollWidth(page)}`);

    await page.waitForFunction(() => typeof Solar !== 'undefined');
    await page.fill('#d1', '1990-05-20');
    await page.fill('#t1', '08:30');
    await page.fill('#d2', '1988-11-03');
    await page.click('#go');
    await page.waitForSelector('#out #pw');
    report(`主页 ${lang} 算出结果`, (await page.innerText('#out')).trim().length > 0);

    await page.click('#pw');
    await page.fill('#em', 'regression@example.com');
    await page.click('#wlgo');
    report(`主页 ${lang} 解锁并提交邮箱`, true);

    report(`主页 ${lang} 走完后 scrollWidth=${WIDTH}`, (await scrollWidth(page)) === WIDTH, `实际 ${await scrollWidth(page)}`);
    report(`主页 ${lang} 无 console 报错`, errors.length === 0, errors.join(' | '));
  } catch (err) {
    report(`主页 ${lang} 主流程`, false, err.message.split('\n')[0]);
  } finally {
    await context.close();
  }
}

async function playbookFlow(browser, base) {
  const { context, page, errors } = await newPage(browser);
  try {
    await page.goto(`${base}/playbook.html`, { waitUntil: 'load' });
    report(`Playbook 初始 scrollWidth=${WIDTH}`, (await scrollWidth(page)) === WIDTH, `实际 ${await scrollWidth(page)}`);

    const before = (await page.locator('#diag').innerText()).trim();
    await page.click('#demo');
    await page.waitForFunction((b) => document.querySelector('#diag').innerText.trim() !== b, before);
    const after = (await page.locator('#diag').innerText()).trim();
    report('Playbook 示例结果算出提示', after.length > 0, `${after.length} 字`);

    report(`Playbook 示例后 scrollWidth=${WIDTH}`, (await scrollWidth(page)) === WIDTH, `实际 ${await scrollWidth(page)}`);
    report('Playbook 无 console 报错', errors.length === 0, errors.join(' | '));
  } catch (err) {
    report('Playbook 示例流程', false, err.message.split('\n')[0]);
  } finally {
    await context.close();
  }
}

const local = process.env.BASE_URL ? null : await serveLocal();
const base = process.env.BASE_URL?.replace(/\/$/, '') ?? `http://127.0.0.1:${local.address().port}`;
console.log(`检查地址：${base}`);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  ...(PROXY ? { proxy: { server: PROXY, bypass: '127.0.0.1,localhost' } } : {}),
});
try {
  await homeFlow(browser, base, 'en');
  await homeFlow(browser, base, 'zh');
  await playbookFlow(browser, base);
} finally {
  await browser.close();
  local?.close();
}

console.log(failures.length ? `\n未通过 ${failures.length} 项` : '\n全部通过');
process.exit(failures.length ? 1 : 0);
