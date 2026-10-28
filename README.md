# HF Space Wake

每天通过 Hugging Face API 检查 `Elykia/ek` 的 runtime 状态。只有 Space 处于休眠状态时才调用 restart API，不持续访问应用页面，也不需要浏览器登录。

## GitHub Actions 配置

1. 在 Hugging Face 创建一个访问令牌：<https://huggingface.co/settings/tokens>。
2. 使用细粒度令牌时，只给 `Elykia/ek` 这个 Space 的写权限。令牌必须能读取 runtime 并重启 Space，不要把令牌写进代码或提交到仓库。
3. 打开 GitHub 仓库的 **Settings → Secrets and variables → Actions**，新增 Secret：
   - 名称：`HF_TOKEN`
   - 值：刚创建的 Hugging Face 令牌
4. 默认目标已经是 `Elykia/ek`。如果以后换 Space，在同一个页面的 **Variables** 中新增或修改：
   - 名称：`HF_SPACE_ID`
   - 值：`namespace/space-name`，例如 `Elykia/ek`
5. 在 **Actions → HF Space Wake → Run workflow** 手动运行一次，确认日志中出现 `space-runtime`。之后工作流会在每天北京时间 09:17（UTC 01:17）运行。

工作流在 Pull Request 中只执行本地回归测试，不使用 `HF_TOKEN`。推送到 `main` 时会执行测试并检查目标 Space。公开仓库长期没有其他仓库活动时，GitHub 可能会停用 schedule；定期查看 Actions 状态。

## 状态处理

- `SLEEPING`：调用 `POST /api/spaces/{namespace}/{space}/restart`。
- `STOPPED`：当前 Hugging Face API 用于闲置停止的状态，也调用 restart。
- `RUNNING`、构建中和错误状态：只记录状态，不重复操作。
- `PAUSED`：视为手动暂停，跳过，避免自动恢复一个明确被暂停的 Space。

社区示例只判断 `SLEEPING`，但 Hugging Face 当前 SDK 的状态枚举使用 `STOPPED`/`PAUSED`。脚本兼容两种命名，避免只照搬社区脚本后无法唤醒当前 API 返回的状态。

这个方案是周期性唤醒，不是常驻运行保证。免费硬件仍可能在两次任务之间休眠；GitHub schedule 也可能延迟。不要改成每几分钟 ping，社区已有高频自动访问触发 abuse-handler 暂停或账号锁定的案例。如果以后把目标 Space 升级到付费硬件，手动或自动 restart 后会产生硬件费用。

## 本地运行

需要 Node.js 24 或更新版本：

```sh
npm ci
npx playwright install chromium
npm test
```

PowerShell：

```powershell
$env:HF_TOKEN = 'hf_...'
$env:HF_SPACE_ID = 'Elykia/ek'
npm run wake
```

Linux/macOS：

```sh
HF_TOKEN=hf_... HF_SPACE_ID=Elykia/ek npm run wake
```

`npm test` 会运行 API 唤醒逻辑的单元测试和本地模拟服务器的 Playwright 回归测试。`npm run keepalive` 仍可用于需要时用真实 Chromium 检查页面、图片和 `/healthz`，但每日工作流不再用浏览器访问 Space。

## 相关文件

- `.github/workflows/hf-keepalive.yml`：每日检查并按需唤醒。
- `scripts/wake-space.mjs`：读取 runtime 并调用 restart API。
- `tests/wake-space.test.mjs`：API 脚本的单元测试。
- `tests/keepalive.spec.mjs`：浏览器回归检查。

官方资料：[Space 生命周期和休眠](https://huggingface.co/docs/hub/spaces-gpus#sleep-time)、[管理 Space runtime](https://huggingface.co/docs/huggingface_hub/guides/manage-spaces)、[GitHub Actions 定时任务](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)。
