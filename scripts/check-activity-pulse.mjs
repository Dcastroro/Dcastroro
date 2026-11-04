import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({headless: true});
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({viewport: {width, height: 800}});
    await page.goto(pathToFileURL(`${process.cwd()}/assets/activity-pulse.svg`).href);
    const result = await page.evaluate(() => {
      const root = document.querySelector('svg');
      return {title: root?.querySelector('title')?.textContent, desc: root?.querySelector('desc')?.textContent,
        labels: [...root.querySelectorAll('.label')].map(node => node.textContent),
        counts: [...root.querySelectorAll('.number')].map(node => node.textContent)};
    });
    assert.equal(result.title, 'Public engineering activity');
    assert.match(result.desc, /Last 30 UTC calendar days/);
    assert.equal(result.labels.length, 3);
    assert.ok(result.counts.every(value => /^[\d,]+$/.test(value)));
    const encoded = (await readFile('assets/activity-pulse.svg')).toString('base64');
    await page.goto('about:blank');
    await page.setContent(`<style>body{margin:0}img{max-width:100%;height:auto}</style><img alt="Public activity" src="data:image/svg+xml;base64,${encoded}">`);
    await page.locator('img').waitFor();
    const image = await page.locator('img').evaluate(node => ({width: node.getBoundingClientRect().width, loaded: node.complete && node.naturalWidth > 0}));
    assert.ok(image.loaded, 'Dashboard image failed to load');
    assert.ok(image.width <= width, 'Dashboard image exceeds viewport');
    await page.close();
  }
  console.log('Playwright: activity pulse rendered with valid metrics at mobile and desktop widths.');
} finally {
  await browser.close();
}
