// Round 3 (U, 2026-10-02): the player re-check fixes in the real game at four sizes.
// K-01 the unmet 개간지 확장 condition has its button on the operations card and in the rank dialog, and it opens the
// expansion tool; K-03 방역 locks with what is missing and an import button; K-09 the phone card folds to one line;
// J4 a depleted lumber camp keeps 묘목 심기/영토 확장 under another stall; K-11 a hostile nation reads as not startable.
// Usage: TG_OUT=docs/verification/fix-20260930 node tests/fix-20260930/browser-player-fixes.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, sim, shot, save, browser, log, raf, closeAll } from '../audit-2/_browser.mjs';

const sizes = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
const OUT = { sizes: {} }, fails = [];
const check = (id, ok, detail) => { log((ok ? 'PASS ' : 'FAIL ') + id + ' ' + JSON.stringify(detail ?? '').slice(0, 400)); if (!ok) fails.push(id); };
const settle = async page => { await raf(page); await page.waitForTimeout(250); };

for (const vp of sizes) {
  const tag = vp.width + 'x' + vp.height, r = OUT.sizes[tag] = {}, phone = vp.width <= 700 || (vp.height <= 560 && vp.width >= vp.height);
  const page = await open(vp);
  try {
    await toHome(page);
    // K-11 first: a hostile nation on the start screen.
    await page.getByRole('button', { name: '새 게임' }).click(); await page.locator('.start-button').waitFor();
    const hostile = await page.locator('#realm option').evaluateAll(os => os.find(o => o.parentElement.label?.includes('적대'))?.value);
    await page.locator('#realm').selectOption(hostile); await settle(page);
    r.hostile = await page.evaluate(() => ({ h2: document.querySelector('.realm-place h2')?.textContent, section: [...document.querySelectorAll('.realm-section-title')].map(e => e.textContent), start: document.querySelector('.start-button')?.textContent, disabled: document.querySelector('.start-button')?.disabled }));
    check(tag + ' K-11 hostile nation reads as not startable', /시작할 수 없는/.test(r.hostile.h2) && r.hostile.disabled && !r.hostile.section.includes('함께할 종족'), r.hostile);
    await page.locator('.realm-place').scrollIntoViewIfNeeded(); await shot(page, `${tag}-k11-hostile.png`);
    await page.locator('.world-home-back').click(); await page.getByRole('button', { name: '새 게임' }).waitFor();
    // Start in the first playable nation (the world list is being reworked by another team; do not pin a nation id).
    await page.getByRole('button', { name: '새 게임' }).click(); await page.locator('.start-button').waitFor();
    const playable = await page.locator('#realm option').evaluateAll(os => os.find(o => !o.parentElement.label?.includes('적대'))?.value);
    await page.locator('#realm').selectOption(playable); await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
    await page.waitForFunction(() => !!window.tgScene?.sim && window.tgScene.mode === 'warehouse', null, { timeout: 120000, polling: 200 });
    // A town at 개간 농노 (rank index 2) with the expansion condition open; injected through the rules, then the real UI.
    await sim(page, () => { const s = window.tgScene.sim, own = [...s.owned].map(k => k.split(',').map(Number)), free = t => own.find(([x, z]) => !s.canBuild(t, x, z, true));
      for (const t of ['warehouse', 'house', 'well', 'field', 'lumber']) { const p = free(t); if (p) s.build(t, p[0], p[1], true); }
      window.tgScene.setMode(null); s.rank = 2; s.money = 900; s.paused = false; s.speed = 1; s.revision++; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    if (phone) { const fold = page.locator('.ops-fold'); r.folded = await page.locator('.operations-card').evaluate(e => ({ h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), cls: e.className }));
      check(tag + ' K-09 phone card folds to one line', r.folded.h <= 50 && /folded/.test(r.folded.cls), r.folded); await shot(page, `${tag}-k09-folded.png`); await fold.click(); await settle(page); }
    r.goalButtons = await page.locator('.operations-card .goal-action').allInnerTexts();
    check(tag + ' K-01 card shows the 영토 확장 button for 개간지 확장', r.goalButtons.some(t => /영토 확장 · \d+G/.test(t)), r.goalButtons);
    await shot(page, `${tag}-k01-card.png`);
    await page.locator('.operations-card .goal-action', { hasText: '영토 확장' }).click(); await settle(page);
    r.toolAfter = await sim(page, () => window.tgScene.mode);
    check(tag + ' K-01 the button opens the expansion tool', r.toolAfter === 'expand', r.toolAfter);
    await page.keyboard.press('Escape'); await settle(page);
    // Rank dialog row.
    await page.locator('.objective-card').click(); await page.locator('.promotion-box').waitFor();
    r.dialogButtons = await page.locator('.promotion-box .goal-action').allInnerTexts();
    check(tag + ' K-01 rank dialog row has the same button', r.dialogButtons.some(t => /영토 확장/.test(t)), r.dialogButtons);
    await shot(page, `${tag}-k01-dialog.png`);
    await page.locator('.promotion-box .goal-action', { hasText: '영토 확장' }).click(); await settle(page);
    r.dialogTool = await sim(page, () => ({ mode: window.tgScene.mode, dialog: !!document.querySelector('[role=dialog]') }));
    check(tag + ' K-01 dialog button closes the dialog and opens the tool', r.dialogTool.mode === 'expand' && !r.dialogTool.dialog, r.dialogTool);
    await page.keyboard.press('Escape'); await settle(page);
    // K-03: infection with no wood and water.
    await sim(page, () => { const s = window.tgScene.sim; s.health.infection = 40; s.stock.wood = 0; s.stock.water = 0; s.revision++; });
    await page.waitForTimeout(600);
    r.sanitize = await page.evaluate(() => { const b = [...document.querySelectorAll('.health-alert button')].find(x => x.textContent.includes('방역')); return { disabled: b?.disabled, note: document.querySelector('.health-alert .cost-short')?.textContent }; });
    check(tag + ' K-03 방역 locks and names what is missing', r.sanitize.disabled === true && /목재 3/.test(r.sanitize.note || '') && /물 8/.test(r.sanitize.note || '') && /수입/.test(r.sanitize.note || ''), r.sanitize);
    await shot(page, `${tag}-k03-sanitize.png`);
    await sim(page, () => { const s = window.tgScene.sim; s.health.infection = 0; s.stock.wood = 40; s.stock.water = 30; });
    // J4: the lumber camp runs dry while another facility is stalled first.
    await sim(page, () => { const s = window.tgScene.sim; for (const t of s.tiles) if (t.nature === 'tree' && Math.abs(t.x - s.buildings.find(b => b.type === 'lumber').x) <= 4 && Math.abs(t.z - s.buildings.find(b => b.type === 'lumber').z) <= 4) { t.remaining = 0; t.nature = null; } s.revision++; });
    await page.waitForTimeout(2500);
    r.j4 = await page.evaluate(() => ({ blocks: [...document.querySelectorAll('.operations-card .bottleneck strong')].map(e => e.textContent), fixes: [...document.querySelectorAll('.operations-card .fix-actions button')].map(e => e.textContent) }));
    const dry = r.j4.blocks.some(t => t.includes('벌목장 · 자원 고갈'));
    check(tag + ' J4 depleted lumber camp keeps its fix buttons', !dry || (r.j4.fixes.some(t => t.includes('영토 확장'))), r.j4);
    await shot(page, `${tag}-j4-ops.png`);
    // K-02 screen side: three sides of the well taken, the house preview on the fourth reads as the rule's refusal, and a
    // shut-in facility card offers its neighbours to select.
    const k2 = await sim(page, () => { const s = window.tgScene.sim, w = s.buildings.find(b => b.type === 'well'), sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, c]) => [w.x + a, w.z + c]);
      const open = sides.filter(([x, z]) => !s.at(x, z) && s.tile(x, z)?.terrain !== 'water' && s.ownedAt(x, z));
      for (const [x, z] of open.slice(0, -1)) s.build('stable', x, z, true).ok || s.build('house', x, z, true);
      const last = sides.filter(([x, z]) => !s.at(x, z) && s.ownedAt(x, z))[0]; return { last, error: last ? s.canBuild('house', last[0], last[1], true) : null }; });
    r.k2rule = k2;
    if (k2.last && k2.error) {
      await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('tab', { name: '주거' }).click();
      await page.getByRole('button', { name: '주민 주택 건설', exact: true }).click();
      const { tilePoint } = await import('../audit-2/_browser.mjs'); const p = await tilePoint(page, k2.last[0], k2.last[1]); await page.mouse.move(p.px, p.py); await page.waitForTimeout(400);
      r.k2preview = await page.evaluate(() => document.querySelector('.placement-hint')?.innerText.replace(/\s+/g, ' '));
      check(tag + ' K-02 preview shows the rule refusal for a blocking spot', (r.k2preview || '').includes(k2.error), { rule: k2.error, shown: r.k2preview });
      await shot(page, `${tag}-k02-preview.png`); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await settle(page);
    }
    await sim(page, () => { const s = window.tgScene.sim, w = s.buildings.find(b => b.type === 'well'); s.paused = true; for (const b of s.buildings) if (b !== w) b.status = '생산 중'; w.status = '출입구 막힘'; s.revision++; });
    await page.keyboard.press('2'); await page.waitForTimeout(500);
    r.k2card = await page.evaluate(() => [...document.querySelectorAll('.operations-card .fix-actions button')].map(b => b.textContent));
    check(tag + ' K-02 shut-in card offers its neighbours', r.k2card.some(t => / 선택$/.test(t)), r.k2card);
    await shot(page, `${tag}-k02-card.png`);
  } catch (e) { r.error = String(e.message || e).slice(0, 400); check(tag + ' flow', false, r.error); await shot(page, `${tag}-player-failure.png`).catch(() => {}); }
  await page.context().close();
}
OUT.R = R; OUT.fails = fails;
check('no page errors or console errors', !R.errors.length && !R.consoleErrors.length, { e: R.errors.slice(0, 3), c: R.consoleErrors.slice(0, 3) });
await save('player-fixes.json', OUT); await browser.close();
console.log(fails.length ? 'FAIL ' + fails.join(' | ') : 'player fixes PASS'); process.exit(fails.length ? 1 : 0);
