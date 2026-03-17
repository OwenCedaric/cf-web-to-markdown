# Cloudflare Web to Markdown

一个基于 Cloudflare Browser Rendering API 的轻量级网页转 Markdown 工具。提供现代化的前端界面和简单的 API 接口。

## 功能特点

- **快速转换**：利用 Cloudflare 强大的浏览器渲染能力。
- **现代化 UI**：简洁美观的响应式设计。
- **支持 API**：可以通过简单的 GET/POST 请求调用。
- **CORS 支持**：方便集成到其他项目中。

## 快速开始

### 1. 配置环境

在 `wrangler.toml` 中配置你的 Cloudflare 账户信息。

**API 令牌权限要求：**
为了使 Browser Rendering API 正常工作，你需要创建一个具有以下权限的 API 令牌：
- **账户 (Account)** -> **Browser Rendering** -> **编辑 (Edit)**

```toml
[vars]
CLOUDFLARE_ACCOUNT_ID = "你的账户ID"
CLOUDFLARE_API_TOKEN = "你的API令牌"
```

> [!TIP]
> 建议将 `CLOUDFLARE_API_TOKEN` 设置为秘密以增强安全性：
> `npx wrangler secret put CLOUDFLARE_API_TOKEN`

### 2. 本地开发

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:8787` 即可使用。

### 3. 部署

```bash
pnpm deploy
```

## API 使用

### GET 请求
`/api/markdown?url=https://example.com`

或者直接在根路径访问：
`/?url=https://example.com`

### POST 请求
向 `/api/markdown` 发送 JSON 正文：
```json
{
  "url": "https://example.com"
}
```

## 项目结构

- `public/`: 存放前端静态资源 (Swiss Style UI)
- `src/`: 运行在 Cloudflare Workers 上的后端 API
- `wrangler.toml`: 项目配置文件

## 许可证

MIT
