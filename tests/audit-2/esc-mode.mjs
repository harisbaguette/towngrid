// When is the warehouse placement mode lost: on opening a dialog, on closing it with X, or with Escape?
import { R, open, toHome, newGameFromHome, sim, browser, save } from './_browser.mjs';
const page = await open({ width: 1366, height: 768 }); const r = {};
await toHome(page); await newGameFromHome(page);
const mode = () => sim(page, () => window.tgScene.mode);
const openSettings = async () => { await page.locator('.header-actions button[aria-label="게임 설정"]').click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(300); };
r.start = await mode();
await openSettings(); r.dialogOpen = await mode(); r.focusInDialog = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
await page.locator('[role=dialog] [data-slot=dialog-close]').first().click(); await page.waitForTimeout(300); r.afterX = await mode();
await page.locator('.tutorial-card button', { hasText: '창고' }).click().catch(() => {}); r.reselected = await mode();
await openSettings(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); r.afterEsc = await mode();
r.R = R; await save('esc-mode.json', r); console.log(JSON.stringify(r)); await browser.close();
