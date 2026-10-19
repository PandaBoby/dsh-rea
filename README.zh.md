# dsh-rea

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件包（bundle），
把 **REA（Reverse Engineer Anything）** 的 MCP 服务器挂载成 `rea` 工具命名空间，
并在「插件」页给它一个普通的开关。

这个包**不含任何分析引擎、工具实现或模型代码**。它只是一份声明：一行 MCP 桥接配置，
加上让它在插件列表里显示成卡片的展示元数据。所有真正的 REA 工具都在运行时从
`rea-agents` 包中发现。

## 为什么做成 bundle，而不是一段 YAML

把同样的几行写进 `~/.dsh/cordis.patch.yml` 也能用，但那一行对「插件」页是不可见的——
该页列出的是 **bundle**（带 `dsh.bundle.patch` 的包），而不是散落的配置行。
把它包成 bundle，才变成一个可以点开、查完再点回去的开关。

开关之所以重要，是因为 `rea` 命名空间在开启期间很贵：约 200 个工具 schema 会跟着
**每一次**请求发送。

| 状态 | 发送的工具数 | 工具定义占用 |
| --- | --- | --- |
| dsh-rea 关闭 | 约 40 个内置工具 | 约 2K–8K tokens |
| dsh-rea 开启 | 约 40 + 约 207 | **约 200K tokens** |

以 `rea-agents@6.5.0` 在 1M 窗口上实测：schema 序列化约 790 KB，harness 估值为
约 207K tokens，约占窗口的 20%。该数字随 REA 版本变化，但只要开关是开的就不会是零。

## 安装

从 GitHub 安装：

```
dsh plugin add github:PandaBoby/dsh-rea
```

或从本地目录安装（开发这个包时用这种形式）：

```
dsh plugin add /absolute/path/to/dsh-rea
```

安装会同时**选中**该 bundle，`rea` 工具立刻可用；用完在插件页关掉即可。如果需要 REA 自带的流程指引，
再单独安装 `rea-agents` 提供的 skill；本包刻意不复制它。

REA 服务本身不在安装时下载。桥接会执行 `npx -y rea-agents@latest mcp`，
因此 npm 会在开关打开后的首次工具同步时拉取最新版本，之后复用缓存。

## 开关

**插件页 → 已安装插件 → dsh-rea**，切换开关即可。

- **开** —— MCP 桥接启动，枚举 REA 工具，并以 `mcp__rea__*` 注册。
- **关** —— 该行被撤下，子进程被回收，工具 schema 不再发送。之后每次请求少约 200K tokens。

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
    args: ["-y", "rea-agents@6.5.0", "mcp"]
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

## 核对它到底占多少

输入框上方的上下文仪表盘会把用量拆成系统提示词、工具定义、对话消息三行。
切换 bundle 前后对比**工具定义**那一行，差值就是本插件的开销。也可以读取
`~/.dsh/sessions/` 下会话日志里最新的一条 `request/header`，数 `mcp__rea__*` 的条目。

## 卸载

插件页 → dsh-rea → **移除**。移除会注销该行并允许删除包；`npx` 缓存在 profile 之外，
会一直保留到 npm 或 `npx` 自行清理。

## 目录结构

```
package.json        name、description、icon、dsh.bundle.patch
cordis.patch.yml    唯一的一行 insert：mcp-client 连接到 `rea mcp`
icon.svg            卡片图标
locale/en.json      卡片标题与描述
locale/zh.json      同上，中文
```

## 许可

MIT。REA 本身是独立项目，遵循它自己的许可；本包只声明如何连到它。
