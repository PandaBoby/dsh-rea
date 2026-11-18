# dsh-rea

中文 · [English](./README.md)

![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![node](https://img.shields.io/badge/node-%5E22.23.4%20%7C%7C%20%5E24.22.1%20%7C%7C%20%3E%3D26.12.1-informational)
![validate](https://github.com/PandaBoby/dsh-rea/actions/workflows/validate.yml/badge.svg)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件包（bundle），
把 **REA（Reverse Engineer Anything）** 的 MCP 服务器挂载成 `rea` 工具命名空间，
并在「插件」页给它一个普通的开关。

- **它是什么** —— 一行 MCP 桥接配置，被包装成 bundle，才能出现在插件页变成卡片和开关。
- **它不是什么** —— 不含分析引擎、工具实现或模型代码。所有 REA 工具都在运行时从
  `rea-agents` 包中发现。

## 为什么做成 bundle，而不是一段 YAML

把同样的几行写进 `~/.dsh/cordis.patch.yml` 也能用，但那一行对「插件」页是不可见的——
该页列出的是 **bundle**（带 `dsh.bundle.patch` 的包），而不是散落的配置行。
把它包成 bundle，才变成一个可以点开、查完再点回去的开关。

开关之所以重要，是因为 `rea` 命名空间在开启期间很贵：255 个工具 schema 会跟着
**每一次**请求发送（`rea-agents@6.9.0` 实测）。

| 状态 | 发送的工具数 | 工具定义占用 |
| --- | --- | --- |
| dsh-rea 关闭 | 仅内置工具 | 约 2K–8K tokens |
| dsh-rea 开启 | 内置 + 255 | **约 200K+ tokens** |

以 `rea-agents@6.5.0` 在 1M 窗口上实测：schema 序列化约 790 KB，harness 估值为
约 207K tokens，约占窗口的 20%。该数字随 REA 版本变化：6.9.0 的同一份列表有 255 个
工具，`tools/list` 原始 JSON 为 4.44 MB，而 6.5.0 是 207 个 / 2.94 MB。
升级后重新测量；只要开关是开的就不会是零。

## 运行要求

- 带「插件」页的 DeepSeek Harness（桌面版与 Web profile 都有）。
- **Node `^22.23.4 || ^24.22.1 || >=26.12.1`。** `rea-agents` 6.8.0 起在更低的版本上
  直接拒绝启动：服务打印要求后退出，桥接拿到的是零个工具，而不是一个报错。
- 首次打开开关时需要网络，让 `npx` 拉取最新的 `rea-agents` 版本。之后复用 npm 缓存。

先核对运行时：

```sh
npx -y rea-agents@latest --version   # 版本受支持时会打印 6.9.0 或更高
```

## 安装

从 GitHub 安装：

```sh
dsh plugin add github:PandaBoby/dsh-rea
```

或从本地目录安装（开发这个包时用这种形式）：

```sh
dsh plugin add /absolute/path/to/dsh-rea
```

`dsh plugin add` 会同时选中该 bundle，`rea` 工具立刻可用。如果你的做法是把这个包当成
普通依赖加进 profile，那就还必须把它写进该 profile 的 `dsh.profile.bundles`——只作为依赖
存在的 bundle 不会被组装，`rea` 命名空间永远不会出现。

安装时不会下载 REA 服务本身。桥接会执行 `npx -y rea-agents@latest mcp`，
因此 npm 会在开关打开后的首次工具同步时拉取最新版本，之后复用缓存。

需要 REA 自带的流程指引时，再单独安装 `rea-agents` 提供的 skill
（见 [REA 仓库](https://github.com/morluto/rea)）；本包刻意不复制它。

## 开关

**插件页 → 已安装插件 → dsh-rea**，切换开关即可。

- **开** —— MCP 桥接启动，枚举 REA 工具，并以 `mcp__rea__*` 注册。
- **关** —— 该行被撤下，子进程被回收，工具 schema 不再发送。之后每次请求少约 200K tokens
  （6.9.0 更多）。

开关是 profile 级设置：对该 profile 的所有会话生效，包括已经打开的会话。
关闭时如果正有 REA 调用在跑，该调用会被取消。

开着 HMR 时（桌面版和 Web profile 的默认状态）无需重启；没有 HMR 则下次启动生效。

## 配置

默认值在 [`cordis.patch.yml`](./cordis.patch.yml)。需要固定 REA 版本、为慢速反编译
调高调用超时，或让启动失败显式报错时，在你的 profile patch 里覆盖 `rea-mcp` 行：

```yaml
- id: rea-mcp
  config:
    serverName: rea
    transport: stdio
    command: npx
    args: ["-y", "rea-agents@6.9.0", "mcp"]
    toolCallTimeoutMs: 600000
    failOnStartupError: false
```

patch 是**整体替换**该行的 `config`，不是合并，所以要保留的键必须全部重写。

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `serverName` | `rea` | 工具名前缀（`mcp__rea__<tool>`），最长 32 字符 |
| `command` / `args` | `npx` + `-y rea-agents@latest mcp` | 要启动的 stdio 服务器 |
| `toolCallTimeoutMs` | `60000` | 单次调用预算，长时间分析可调高 |
| `failOnStartupError` | `false` | 设为 `true` 时，启动失败会显式报错而不是静默无工具 |
| `reconnect` | 内置策略 | 子进程掉线时的重试与退避 |

## 排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 完全没有 `rea` 命名空间 | profile 没有选中该 bundle | 打开开关；若只是把它当依赖加进来，还要写进 `dsh.profile.bundles` |
| 命名空间在，但零个工具 | 引擎没能启动——多数是 Node 版本不够，或首次同步时 `npx` 连不上仓库 | 在同一环境里跑 `npx -y rea-agents@latest --version`；把 `failOnStartupError` 设为 `true` 让下次失败显式报错 |
| 工具在，但调用超时 | 默认每次调用 60 秒 | 调高 `toolCallTimeoutMs` |
| 需要固定引擎版本 | `@latest` 会随每次发版漂移 | 在 `args` 里固定 `rea-agents@x.y.z` |

## 核对它到底占多少

输入框上方的上下文仪表盘会把用量拆成系统提示词、工具定义、对话消息三行。
切换 bundle 前后对比**工具定义**那一行，差值就是本插件的开销。也可以读取
`~/.dsh/sessions/` 下会话日志里最新的一条 `request/header`，数 `mcp__rea__*` 的条目。

## 开发

```sh
npm ci
npm run validate
```

`npm run validate` 检查的全部是不容易被人注意到的腐坏：manifest 必填字段及其指向的路径、
`cordis.patch.yml` 是否是一行使用 `npx … mcp` 的 `rea-mcp` insert、`en`/`zh` 两张语言卡片
是否暴露同样的键、图标是不是真的 SVG，以及 `CHANGELOG.md` 最新条目是否等于 `package.json`
的版本。CI 在 Node 22 与 24 上跑同一套检查。

这里没有可测的源码：引擎在 `rea-agents` 里，本仓库只声明怎么连到它。
分析行为的问题请报到 [REA 仓库](https://github.com/morluto/rea)。

## 卸载

插件页 → dsh-rea → **移除**。移除会注销该行并允许删除包；`npx` 缓存在 profile 之外，
会一直保留到 npm 或 `npx` 自行清理。

## 许可

MIT，见 [LICENSE](./LICENSE)。REA 本身是独立项目，遵循它自己的许可；本包只声明如何连到它。
