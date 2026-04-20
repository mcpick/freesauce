import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../public/og.png');

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Inter:wght@400;600;700&display=swap');
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #c0392b 0%, #922b21 100%);
    color: white;
    text-align: center;
    padding: 48px;
    box-sizing: border-box;
  }
  h1 {
    font-family: 'Lilita One', cursive;
    font-size: 128px;
    margin: 0 0 24px;
    line-height: 1;
    letter-spacing: 2px;
  }
  .sub {
    font-family: 'Lilita One', cursive;
    font-size: 40px;
    margin: 0 0 36px;
    opacity: 0.95;
    letter-spacing: 4px;
  }
  .tag {
    font-size: 28px;
    font-style: italic;
    opacity: 0.9;
    max-width: 900px;
  }
  .emoji {
    font-size: 120px;
    margin-bottom: 12px;
  }
</style>
</head>
<body>
  <div class="emoji">🥧 🥫</div>
  <h1>FREE SAUCE</h1>
  <div class="sub">AT EVERY PIE SHOP IN AUSTRALIA</div>
  <div class="tag">Because charging for sauce on a pie is bloody un-Australian.</div>
</body>
</html>`;

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
await browser.close();

console.log(`Wrote ${outPath}`);
