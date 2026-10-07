import { test } from '@playwright/test';
import { visitSpace } from '../scripts/visit-space.mjs';

const spaceUrl = 'https://elykia-ek.hf.space/';

test('visit Embykeeper with a real browser', async ({ page, browser }, testInfo) => {
  const network = [];
  const safeUrl = (value) => {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  };
  page.on('response', response => {
    if (response.status() >= 400) {
      network.push({ url: safeUrl(response.url()), status: response.status() });
    }
  });
  page.on('requestfailed', request => {
    network.push({ url: safeUrl(request.url()), error: request.failure()?.errorText });
  });

  try {
    const result = await visitSpace(page, spaceUrl);
    console.log(JSON.stringify({ ...result, browser: browser.version() }));
  } finally {
    await testInfo.attach('visit-details', {
      body: Buffer.from(JSON.stringify({
        target: spaceUrl,
        currentUrl: safeUrl(page.url()),
        browser: browser.version(),
        viewport: page.viewportSize(),
        time: new Date().toISOString(),
        network
      }, null, 2)),
      contentType: 'application/json'
    });
  }
});
