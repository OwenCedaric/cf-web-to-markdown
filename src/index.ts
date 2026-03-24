export interface Env {
    ASSETS: Fetcher;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        let targetUrl = url.searchParams.get('url');

        // 1. Handle POST requests
        if (!targetUrl && request.method === 'POST') {
            try {
                const body = (await request.json()) as { url?: string };
                targetUrl = body.url || null;
            } catch (e) { }
        }

        // 2. Main API Logic
        if (targetUrl && targetUrl.trim() !== '') {
            const accountId = env.CLOUDFLARE_ACCOUNT_ID;
            const apiToken = env.CLOUDFLARE_API_TOKEN;

            if (!accountId || !apiToken) {
                console.error('Configuration missing');
                return this.serveFrontend(request, env);
            }

            // --- 阶段 1: 尝试主服务 (Cloudflare Browser Rendering) ---
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

            // --- 阶段 2: 降级服务竞速 (Promise.any) ---
            console.log(`Starting fallback race for ${targetUrl}`);
            
            // 易于维护的第三方服务数组，可随时增删
            const fallbackServices = [
                `https://r.jina.ai/${targetUrl}`,
                `https://defuddle.md/${targetUrl}`
            ];

            try {
                // 并发请求所有降级服务，取第一个成功的结果
                const fastestMarkdown = await Promise.any(
                    fallbackServices.map(serviceUrl => this.fetchFallback(serviceUrl))
                );
                
                return this.createMarkdownResponse(fastestMarkdown);
            } catch (error) {
                // 只有当数组里所有的 API 都报错/超时的时候，才会走到这里
                console.error(`All fallback services failed for ${targetUrl}:`, error);
            }

            // --- 阶段 3: 终极兜底 ---
            console.error(`All conversion methods failed for ${targetUrl}, falling back to frontend.`);
            return this.serveFrontend(request, env);
        }

        // 3. Serve Frontend Logic
        return this.serveFrontend(request, env);
    },

    // 辅助函数：执行降级请求，自带超时机制
    async fetchFallback(url: string): Promise<string> {
        const controller = new AbortController();
        // 设置 15 秒超时，防止 Worker 被无限挂起
        const timeoutId = setTimeout(() => controller.abort(), 15000); 

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} from ${url}`);
            }
            return await response.text();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error; // 抛出错误让 Promise.any 知道这个请求失败了
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

    async serveFrontend(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        // If the path is root, explicitly fetch ui.html
        if (url.pathname === '/') {
            const uiRequest = new Request(new URL('/ui.html', request.url), request);
            return env.ASSETS.fetch(uiRequest);
        }

        return env.ASSETS.fetch(request);
    }
};
