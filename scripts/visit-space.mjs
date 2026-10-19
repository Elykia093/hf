import { expect } from '@playwright/test';

// Only the initial GET is polled: a sleeping Space can return 502/503/504
// while starting. Authentication errors and invalid pages fail immediately.
export async function visitSpace(page, url, { startupTimeout = 600_000, logger = console.log } = {}) {
  let response;
  let attempt = 0;
  const target = new URL(url);
  const safeTarget = `${target.origin}${target.pathname}`;
  const requestIdHeaders = ['x-request-id', 'request-id', 'x-correlation-id', 'x-amzn-requestid', 'cf-ray'];

  await expect.poll(async () => {
    attempt += 1;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      logger(JSON.stringify({
        event: 'space-main-document',
        target: safeTarget,
        attempt,
        status: null,
        requestId: null,
        navigationError: error?.name ?? 'Error',
        time: new Date().toISOString()
      }));
      throw error;
    }

    const headers = response?.headers() ?? {};
    const requestIdHeader = requestIdHeaders.find(name => headers[name]);
    logger(JSON.stringify({
      event: 'space-main-document',
      target: safeTarget,
      attempt,
      status: response?.status() ?? null,
      requestId: requestIdHeader ? headers[requestIdHeader] : null,
      requestIdHeader: requestIdHeader ?? null,
      time: new Date().toISOString()
    }));
    return ![502, 503, 504].includes(response?.status());
  }, {
    message: 'Space should finish starting',
    timeout: startupTimeout,
    intervals: [5_000, 15_000, 30_000]
  }).toBe(true);

  expect(response, 'Main document response').not.toBeNull();
  expect(response.status(), 'Main document HTTP status').toBe(200);
  await expect(page).toHaveTitle(/Embykeeper/);
  await expect(page.getByPlaceholder('控制台密码')).toBeVisible();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();

  // Prove that a real browser executed the page's JavaScript and loaded images.
  await page.waitForFunction(() => Boolean(window.bootstrap));
  await expect(page.locator('img[src$="login.svg"]')).toBeVisible();
  await page.waitForFunction(() => {
    const image = document.querySelector('img[src$="login.svg"]');
    return image?.complete && image.naturalWidth > 0;
  });

  const health = await page.evaluate(async () => {
    const result = await fetch('/healthz', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    });
    return { status: result.status, body: (await result.text()).trim() };
  });
  expect(health.status, 'Health endpoint HTTP status').toBe(200);
  expect(health.body, 'Health endpoint body').toBe('200 OK');
  return { title: await page.title(), healthStatus: health.status };
}
