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

        // 2. Routing Decision: If targetUrl exists and is not empty, it's an API call
        if (targetUrl && targetUrl.trim() !== '') {
            const accountId = env.CLOUDFLARE_ACCOUNT_ID;
            const apiToken = env.CLOUDFLARE_API_TOKEN;

            if (!accountId || !apiToken) {
                console.error('Configuration missing: accountId or apiToken');
                // Return frontend on configuration error as requested
                return env.ASSETS.fetch(request);
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

                if (!response.ok) {
                    const error = await response.text();
                    console.error('API Error:', error);
                    // Return frontend on API error as requested
                    return env.ASSETS.fetch(request);
                }

                const data = (await response.json()) as { success: boolean, result: string };
                if (data.success && data.result) {
                    return new Response(data.result, {
                        headers: {
                            'Content-Type': 'text/markdown; charset=utf-8',
                            'Access-Control-Allow-Origin': '*',
                        },
                    });
                } else {
                    console.error('Processing failed or result empty');
                    return env.ASSETS.fetch(request);
                }
            } catch (error) {
                console.error('Conversion error:', error);
                return env.ASSETS.fetch(request);
            }
        }

        // 3. Delegation: Serve the static frontend (Status 200)
        return env.ASSETS.fetch(request);
    },
};
