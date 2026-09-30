// Quick look at the current home screen state (buttons, errors) — used when a probe stalls.
import { R, open, shot, browser, origin } from './_browser.mjs';
const page = await open({ width: 1366, height: 768 });
await page.goto(origin); await page.waitForTimeout(4000);
await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click({ timeout: 5000 }).catch(e => console.log('title click', e.message.split('\n')[0]));
await page.waitForTimeout(6000);
console.log(JSON.stringify({ buttons: await page.locator('button').evaluateAll(bs => bs.map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 30) + (b.disabled ? '(off)' : ''))), overlay: await page.locator('vite-error-overlay').count(), R }, null, 1));
await shot(page, 'peek.png'); await browser.close();
