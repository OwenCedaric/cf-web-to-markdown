export interface Env {
    ASSETS: Fetcher;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // --- 1. 全局 CORS 预检处理 (支持前端 POST 调用) ---
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        const url = new URL(request.url);
        let targetUrl = url.searchParams.get('url');

        // --- 2. 解析 POST 请求体 ---
        if (!targetUrl && request.method === 'POST') {
            try {
                const body = (await request.json()) as { url?: string };
                targetUrl = body.url || null;
            } catch (e) {
                console.warn('Failed to parse POST body');
            }
        }

        // --- 3. 基础 URL 格式验证 ---
        let isValidUrl = false;
        if (targetUrl && targetUrl.trim() !== '') {
            try {
                new URL(targetUrl); 
                isValidUrl = true;
            } catch {
                console.warn(`Invalid URL provided: ${targetUrl}`);
            }
        }

        // --- 4. 核心转换逻辑 ---
        if (isValidUrl && targetUrl) {
            const accountId = env.CLOUDFLARE_ACCOUNT_ID;
            const apiToken = env.CLOUDFLARE_API_TOKEN;

            if (!accountId || !apiToken) {
                console.error('Configuration missing');
                return this.serveFrontend(request, env);
            }

            // 阶段 1: 尝试主服务 (Cloudflare Browser Rendering)
            const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/markdown`;
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiToken}`,
                    },
                    body: JSON.stringify({ url: targetUrl }),
                });

                if (response.ok) {
                    const data = (await response.json()) as { success: boolean, result: string };
                    if (data.success && data.result) {
                        return this.createMarkdownResponse(data.result);
                    }
                }
                console.error(`Cloudflare API conversion failed for ${targetUrl}`);
            } catch (error) {
                console.error('Cloudflare API conversion exception:', error);
            }

            // 阶段 2: 降级服务竞速 (Promise.any)
            console.log(`Starting fallback race for ${targetUrl}`);
            const fallbackServices = [
                `https://r.jina.ai/${targetUrl}`,
                `https://defuddle.md/${targetUrl}`
            ];

            // 核心优化：用于在竞速结束后杀死其他挂起请求的 Controller
            const raceController = new AbortController(); 

            try {
                const fastestMarkdown = await Promise.any(
                    fallbackServices.map(serviceUrl => 
                        this.fetchFallback(serviceUrl, raceController.signal)
                    )
                );
                
                // 竞速结束，立刻终止仍在运行的其他请求，防止 Worker 资源泄漏
                raceController.abort(); 
                return this.createMarkdownResponse(fastestMarkdown);
            } catch (error) {
                raceController.abort();
                console.error(`All fallback services failed for ${targetUrl}:`, error);
            }

            // 阶段 3: 终极兜底
            console.error(`All conversion methods failed for ${targetUrl}, falling back to frontend.`);
            return this.serveFrontend(request, env);
        }

        // 5. 兜底返回前端页面
        return this.serveFrontend(request, env);
    },

    // 辅助函数：执行降级请求，支持外部 AbortSignal 中断
    async fetchFallback(url: string, parentSignal: AbortSignal): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); 

        // 如果外部(Promise.any)发起了中断信号，同步中止当前的 fetch
        parentSignal.addEventListener('abort', () => {
            controller.abort();
            clearTimeout(timeoutId);
        });

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} from ${url}`);
            }
            return await response.text();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error; 
        }
    },

    // 辅助函数：统一构造成功的 Markdown Response
    createMarkdownResponse(markdown: string): Response {
        return new Response(markdown, {
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Access-Control-Allow-Origin': '*', 
            },
        });
    },

    // 辅助函数：处理前端静态资源路由
    async serveFrontend(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/') {
            const uiRequest = new Request(new URL('/ui.html', request.url), request);
            return env.ASSETS.fetch(uiRequest);
        }
        return env.ASSETS.fetch(request);
    }
};
