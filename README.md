# Cloudflare Web to Markdown

一个基于 Cloudflare Browser Rendering API 的高可用网页转 Markdown 工具。内置多路并发竞速降级方案，专为大模型 (LLM) 语料提取与纯净阅读设计，提供现代化的前端界面和极简的 API 接口。

## 功能特点

- **原生渲染驱动**：优先利用 Cloudflare 强大的 Browser Rendering 能力处理目标网页。
- **多路竞速降级 (Racing Fallback)**：当 Cloudflare 主服务受阻时，自动通过 `r.jina.ai` 和 `defuddle.md` 发起并发竞速请求，取最快返回的成功结果，极大提升解析成功率与响应速度。
- **现代化 UI**：简洁美观的响应式设计。
- **开箱即用 API**：支持标准的 GET/POST 请求调用，自带跨域 (CORS) 支持，方便无缝集成到各类 AI Agent 或自动化工作流中。

## 快速开始

### 1. 配置环境

在 `wrangler.toml` 中配置你的 Cloudflare 账户信息。

**API 令牌权限要求：**
为了使主服务（Browser Rendering API）正常工作，你需要创建一个具有以下权限的 API 令牌：
- **账户 (Account)** -> **Browser Rendering** -> **编辑 (Edit)**

```toml
[vars]
CLOUDFLARE_ACCOUNT_ID = "你的账户ID"
CLOUDFLARE_API_TOKEN = "你的API令牌"
```

> [!TIP]
> 建议将 `CLOUDFLARE_API_TOKEN` 设置为秘密以增强安全性：
> `npx wrangler secret put CLOUDFLARE_API_TOKEN`
> 
> *注：即使 Cloudflare API 配置失效或未配置，系统也会自动进入降级模式，尝试通过第三方服务获取数据。*

### 2. 本地开发

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:8787` 即可使用前端 UI 界面。

### 3. 部署

```bash
pnpm deploy
```

## API 使用

接口会直接返回 `text/markdown` 格式的纯文本，非常适合作为大模型的信息输入源。

### GET 请求
`/api/markdown?url=https://example.com`

或者直接在根路径访问（当传入 URL 参数时，自动触发转换逻辑）：
`/?url=https://example.com`

### POST 请求
向 `/api/markdown` 发送 JSON 正文：
```json
{
  "url": "https://example.com"
}
```

## 架构说明

本项目的转换链路采用了高可用设计：
1. **主请求**：尝试使用 Cloudflare Browser Rendering API 获取页面。
2. **竞速降级**：若主请求失败（防爬虫拦截、动态 SPA 渲染超时等），立即启动备用节点池（`r.jina.ai`, `defuddle.md`）进行 `Promise.any` 竞速请求。
3. **安全兜底**：若所有转换节点均失效，则返回服务自带的前端静态页面。

## 项目结构

- `public/`: 存放前端静态资源 (Swiss Style UI)
- `src/`: 运行在 Cloudflare Workers 上的后端 API
- `wrangler.toml`: 项目配置文件

## 许可证

MIT
