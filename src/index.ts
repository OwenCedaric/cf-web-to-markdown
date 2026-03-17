export interface Env {
    ASSETS: Fetcher;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        let targetUrl = url.searchParams.get('url');

        // 1. Handle POST requests as potential API calls
        if (!targetUrl && request.method === 'POST') {
            try {
                const body = (await request.json()) as { url?: string };
                targetUrl = body.url || null;
            } catch (e) { }
        }

        // 2. Main API Logic: If url parameter matches, prioritized it
        if (targetUrl && targetUrl.trim() !== '') {
            const accountId = env.CLOUDFLARE_ACCOUNT_ID;
            const apiToken = env.CLOUDFLARE_API_TOKEN;

            if (!accountId || !apiToken) {
                console.error('Configuration missing');
                return this.serveFrontend(request, env);
            }

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
                        return new Response(data.result, {
                            headers: {
                                'Content-Type': 'text/markdown; charset=utf-8',
                                'Access-Control-Allow-Origin': '*',
                            },
                        });
                    }
                }
                
                // If conversion fails, log and fallback to frontend
                console.error(`Conversion failed for ${targetUrl}`);
                return this.serveFrontend(request, env);
            } catch (error) {
                console.error('Conversion exception:', error);
                return this.serveFrontend(request, env);
            }
        }

        // 3. Serve Frontend Logic
        return this.serveFrontend(request, env);
    },

    async serveFrontend(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        // If the path is root, explicitly fetch ui.html
        if (url.pathname === '/') {
            const uiRequest = new Request(new URL('/ui.html', request.url), request);
            return env.ASSETS.fetch(uiRequest);
        }

        // Otherwise, fallback to the requested asset
        return env.ASSETS.fetch(request);
    }
};
