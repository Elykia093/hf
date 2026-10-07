import { createServer } from 'node:http';
import { test, expect } from '@playwright/test';
import { visitSpace } from '../scripts/visit-space.mjs';

let server;
let baseUrl;
let pageStatus;
let healthStatus;
let healthBody;
let coldStarts;
let requests;

test.beforeEach(async () => {
  pageStatus = 200;
  healthStatus = 200;
  healthBody = '200 OK';
  coldStarts = 0;
  requests = [];
  server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url === '/healthz') {
      response.writeHead(healthStatus, { 'Content-Type': 'text/plain' });
      return response.end(healthBody);
    }
    if (request.url === '/app.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      return response.end('window.bootstrap = {};');
    }
    if (request.url === '/login.svg') {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return response.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    }
    if (coldStarts > 0) {
      coldStarts -= 1;
      response.writeHead(503);
      return response.end('Starting');
    }
    response.writeHead(pageStatus, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<title>Embykeeper | 登录</title><input type="password" placeholder="控制台密码"><button>登录</button><img src="/login.svg"><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

test.afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('loads scripts and images, then checks health in the browser', async ({ page }) => {
  await visitSpace(page, baseUrl);
  expect(requests).toEqual(expect.arrayContaining(['/app.js', '/login.svg', '/healthz']));
});

test('waits for a starting Space to become available', async ({ page }) => {
  coldStarts = 1;
  await visitSpace(page, baseUrl, { startupTimeout: 15_000 });
  expect(requests.filter(url => url === '/').length).toBe(2);
});

test('rejects a main document with an authentication error', async ({ page }) => {
  pageStatus = 401;
  await expect(visitSpace(page, baseUrl)).rejects.toThrow('Main document HTTP status');
  expect(requests).not.toContain('/healthz');
});

test('fails when the health endpoint returns an error', async ({ page }) => {
  healthStatus = 503;
  await expect(visitSpace(page, baseUrl)).rejects.toThrow('Health endpoint HTTP status');
});

test('rejects an HTML error page returned with HTTP 200', async ({ page }) => {
  healthBody = '<html>Service unavailable</html>';
  await expect(visitSpace(page, baseUrl)).rejects.toThrow('Health endpoint body');
});
