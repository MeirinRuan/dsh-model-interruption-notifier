# 安装与开发

[English](guide.md) | 中文

## 安装

当前包只声明支持 DSH `0.2.2-rc.1`。DSH 扩展 API 尚未稳定，其他版本需另行验证。开发需要 Node.js `^22.19.0 || >=24.0.0` 和 pnpm `11.28.5`。

项目发布 Release 后，优先使用 GitHub Releases 中预构建的 `.tgz`。在 DSH 插件管理器中安装下载的文件，或替换下面的路径并运行 DSH CLI。以下示例针对 `web` 配置。使用桌面版 CLI 操作 `desktop` 配置时，需先打开一次桌面版完成初始化，再完全退出桌面版后运行插件命令：

```text
dsh plugin --profile web add <absolute-path-to-downloaded.tgz>
```

归档包含浏览器构建产物，安装时无需本地构建。包的 `dsh.bundle.patch` 挂载 Host；DSH 根据清单发现 Client。禁用包会停止自动继续和提醒。移除公开包使用：

```text
dsh plugin --profile web remove dsh-model-interruption-notifier
```

不要同时启用本包与旧的 `@local/dsh-model-interruption-notifier`：两者使用相同的 Host 插件 ID 和会话投影。启用公开包前先移除或禁用旧包。正常安装公开包不需要旧的本地包。

## 行为

插件详情中的“自动继续”开关默认开启，保存后立即更新 Host 配置。每次新失败轮结束、原会话进入空闲后，Host 提交一次 `继续`。下一轮若再次失败，仍可能再次继续；当前没有尝试次数上限或退避。继续推理可能消耗模型额度。遇到持续错误时可关闭自动继续。

关闭开关后，右下角提醒显示会话标题和错误消息。“确认继续”提交 `继续`；“稍后”或焦点在卡片内时按 Escape，会隐藏本次失败，直到页面重载。新失败仍可提醒。卡片不会抢占焦点。相同角落优先显示待回答的问题。

只有已记录且导致整轮结束的错误符合条件。正常结束、手动停止和请求中途重试不触发。新一轮开始或收到用户消息时清除失败。普通分叉会话包含在内，委派子 Agent 排除。手动确认会重新检查失败序号与运行状态。提交被拒绝时显示错误，不自动重发。

自动继续不依赖页面保持打开。加载插件不会恢复历史失败。实时提醒需要页面连接，隐藏记录只在当前挂载页面内保留。没有留下整轮失败记录的进程崩溃或断网无法触发插件。浏览器外观与真实指针交互需要另行连接浏览器验证。

## 数据与模型影响

插件把失败轮的序号、时间、错误消息和错误码提取到 DSH 会话投影。前端读取会话标题与运行状态。插件不增加工具、系统提示词、外部上报地址或独立凭据存储。

提交 `继续` 会沿用原会话的模型服务和上下文启动正常推理。标题与错误消息可能包含私人项目名、路径或服务诊断。截图、问题反馈和公开演示使用模拟会话；不要随源码发布运行配置或会话日志。

## 开发

在克隆后的仓库中运行：

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm test
```

[构建脚本](https://github.com/MeirinRuan/dsh-model-interruption-notifier/blob/main/scripts/build.mjs)生成已忽略的 `lib/client.js`。测试针对该浏览器产物覆盖失败轮筛选、继续消息受理、自动继续与配置注册；它们不能替代真实 DSH 会话测试。

[Host](../host.mjs)使用会话投影和会话控制器。[Client](https://github.com/MeirinRuan/dsh-model-interruption-notifier/blob/main/client.mjs)使用 DSH 插槽、语言资源、会话引用与原生配置表单。[补丁](../cordis.patch.yml)让插件独立于 DSH 核心修改。

Release 产物与市场提交方式见[发布说明](publishing.zh.md)。
