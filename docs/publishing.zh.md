# 发布与市场收录

[English](publishing.md) | 中文

## 发布 Release

拟使用的公开仓库为 `MeirinRuan/dsh-model-interruption-notifier`。发布前确认仓库归属与公开可见性。仅保留本独立项目的文件和历史；排除 DSH 运行配置、会话日志、凭据和父工作树。[MIT 许可证](../LICENSE)保留继承的 DeepSeek 声明，并为本项目贡献署名。

按[开发说明](guide.zh.md#开发)安装依赖、构建并测试。pnpm 打包时由 `prepack` 重新构建浏览器入口。使用工作区之外已存在的输出目录：

```text
pnpm pack --out <external-output-directory>/dsh-model-interruption-notifier.tgz
```

附加到 GitHub Release 前检查归档。归档需包含 `package/package.json`、声明的补丁、`host.mjs`、`projection.mjs`、`lib/client.js`、语言文件、图标、许可证和文档。开发依赖、测试、个人设置与 Git 元数据不包含在运行包中。

创建公开仓库，推送已审查的提交，并添加 `dsh-plugin` topic。创建版本标签及对应 GitHub Release，附加预构建归档，资产名固定为 `dsh-model-interruption-notifier.tgz`。后续版本保持该资产名，使 `releases/latest/download/` 持续有效。GitHub 自动生成的源码 ZIP 不能代替预构建 npm tarball。

当前兼容声明是 `engines.dsh` 中的精确 DSH 版本。验证相关 Host 与 Client 服务后才能扩大范围。使用 Release 归档不需要发布 npm；npm 发布是可选项，发布包的 `repository` 字段必须与公开 GitHub 仓库一致。

## 申请 dsh-market 收录

市场应用为 [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market)。“申请收录插件”指向 [awesome-dsh-plugin 贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)。收录条目应提交到这个目录仓库，而非市场应用的源码仓库。

公开指南要求有真实可用的代码、声明 `dsh.bundle` 的 `package.json`、活跃维护且创建满一天的仓库，以及 `dsh-plugin` topic。CI 校验提交后，还需维护者阅读目标工程。CI 通过本身不代表获准收录。市场规则可能变化，提交前需重新检查链接中的指南。

向目录仓库提交 PR，仅新增 `data/plugins/MeirinRuan__dsh-model-interruption-notifier.yml`。[已准备的条目](https://github.com/MeirinRuan/dsh-model-interruption-notifier/blob/main/market/MeirinRuan__dsh-model-interruption-notifier.yml)使用 `notify` 分类、符合实际行为的双语描述，以及以下 GitHub Release 地址：

```text
https://github.com/MeirinRuan/dsh-model-interruption-notifier/releases/latest/download/dsh-model-interruption-notifier.tgz
```

提交条目前先公开仓库并发布可下载的 Release 资产。不要手工编辑目录的生成 README，也不要在 YAML 中添加 `npm:` 字段。指南支持不发布 npm、直接使用 GitHub Release 归档。可选的市场图标必须是 GitHub 托管的位图；插件 SVG 仍可作为包图标，但不作为市场条目图标提交。

维护者可能在 PR 评论中要求修改。在同一分支修复后，用一条回复说明修改。目录网站在合并后重建；创建 Release、审核收录和市场同步是不同环节。
