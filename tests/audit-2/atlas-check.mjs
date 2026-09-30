// World-map atlas rendering check at several viewport sizes: SVG size, focus buttons, icon sizes, stylesheet rules.
import { R, open, toHome, shot, browser, save } from './_browser.mjs';
const out = {};
for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(vp);
  await toHome(page);
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor();
  await page.waitForTimeout(1200);
  out[page.tag] = await page.evaluate(() => {
    const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    const atlas = document.querySelector('.world-atlas'), svg = atlas?.querySelector('svg');
    const svgs = [...(atlas?.querySelectorAll('svg') || [])].map(s => ({ cls: String(s.className.baseVal), box: box(s), viewBox: s.getAttribute('viewBox') })).sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]).slice(0, 6);
    const buttons = [...(atlas?.querySelectorAll('button') || [])].map(b => ({ text: b.innerText.trim().slice(0, 20), aria: b.getAttribute('aria-label'), box: box(b) }));
    const sheets = [...document.styleSheets].map(s => { try { return { href: s.href?.slice(-60), rules: s.cssRules.length, atlasRules: [...s.cssRules].filter(r => /atlas|world-terrain|world-atlas/.test(r.cssText)).length }; } catch { return { href: s.href, blocked: true }; } });
    return { atlas: box(atlas), atlasCls: atlas?.className, svgs, buttons, sheets, shell: box(document.querySelector('.atlas-shell')), terrain: box(document.querySelector('.world-terrain')), controls: box(document.querySelector('.atlas-controls')) };
  });
  await shot(page, `B-atlas-${page.tag}.png`);
  await page.close();
}
out.R = R;
await save('atlas-check.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
await browser.close();
