# HF Browser Keepalive

每天使用 Playwright 启动真实的无头 Chromium，访问 [Embykeeper Space](https://elykia-ek.hf.space/)，尝试维持 Space 活跃并验证页面可用。

## 自动运行

- GitHub Actions 每天 **北京时间 09:17（UTC 01:17）** 执行一次。
- 推送到 `main` 后也会执行；支持在 [Actions 页面](https://github.com/Elykia093/hf/actions/workflows/hf-keepalive.yml) 点击 **Run workflow** 手动运行。
- Pull Request 只执行本地模拟服务器回归测试，不访问真实 Space。
- 不需要 HF Token 或控制台密码；使用全新的浏览器上下文，只访问公开登录页，不提交登录表单。

## 每次检查什么

1. Chromium 打开页面，实际加载 JavaScript 和图片。
2. 主文档必须返回 HTTP 200，标题包含 `Embykeeper`，密码框和登录按钮可见。
3. 确认 Bootstrap JavaScript 已执行、登录插图加载完成。
4. 在同一浏览器页面内请求 `/healthz`，必须返回 HTTP 200 且正文为 `200 OK`。

Space 启动阶段的 HTTP 502/503/504 会在最多 20 分钟内逐步重试。其他错误、缺失页面元素、资源或健康检查失败会让任务失败；不会把错误页面当作成功。

每次运行保留截图、访问详情和 HTML 报告；失败时额外保留 Playwright trace 和视频。可在 Actions 运行详情的 **Artifacts** 下载 `browser-evidence-*`，保存 7 天。任务失败通知由你自己的 GitHub Actions 通知设置控制。

## 本地运行

需要 Node.js 24 或更新版本：

```sh
npm ci
npx playwright install chromium
npm test
npm run keepalive
```

Linux 首次运行建议用 `npx playwright install --with-deps chromium` 安装系统依赖。`npm test` 使用本地 HTTP 服务器和真实 Chromium，覆盖资源加载、冷启动、HTTP 401、健康接口失败和错误正文；`npm run keepalive` 才会访问真实 Space。

查看结果：`npx playwright show-report`。截图和诊断文件位于 `test-results/`，报告位于 `playwright-report/`。再次运行会更新这些本地产物。

## 配置与停止

- 每日时间：修改 `.github/workflows/hf-keepalive.yml` 的 cron，时区为 UTC。
- Space 地址：修改 `tests/keepalive.spec.mjs` 中的 `spaceUrl`。目前断言针对 Embykeeper 登录页，换成其他应用时须同步修改 `scripts/visit-space.mjs` 和回归用例。
- 暂停：在 Actions 工作流菜单选择 **Disable workflow**。恢复时选择 **Enable workflow**。
- 回滚：暂停工作流后，revert 对应提交，再推送到 `main`。

## 限制

这实现的是每日浏览器访问，不代表已经验证 Space 长期不会休眠。免费 Space 的休眠策略由 Hugging Face 决定，浏览器访问无法保证全天持续在线。

GitHub 定时任务可能延迟，繁忙时可能丢弃排队任务；只在默认分支运行。公开仓库连续 60 天没有仓库活动时，定时工作流会自动停用，因此需要定期查看工作流状态；不能把每日 Actions 执行视为一定会重置该期限。

官方说明：[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[Hugging Face Space 休眠策略](https://huggingface.co/docs/hub/spaces-gpus#sleep-time)。
