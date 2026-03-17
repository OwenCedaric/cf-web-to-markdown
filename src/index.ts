export interface Env {
	BROWSER: Fetcher;
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_API_TOKEN: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Only handle calls to /api/markdown or direct ?url= calls if needed
		// Assets are served automatically for other routes
		if (url.pathname === '/api/markdown' || url.searchParams.has('url')) {
			let targetUrl = url.searchParams.get('url');

			// Also try to get URL from JSON body for POST requests
			if (!targetUrl && request.method === 'POST') {
				try {
					const body = (await request.json()) as { url?: string };
					targetUrl = body.url || null;
				} catch (e) {
					// Ignore JSON parsing errors
				}
			}

			if (!targetUrl) {
				return new Response('Missing "url" parameter', { status: 400 });
			}

			// Cloudflare Browser Rendering API endpoint
			const accountId = env.CLOUDFLARE_ACCOUNT_ID;
			const apiToken = env.CLOUDFLARE_API_TOKEN;

			if (!accountId || !apiToken) {
				return new Response('Worker not configured: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing', { status: 500 });
			}

			const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/markdown`;

			try {
				const response = await fetch(apiUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${apiToken}`,
					},
					body: JSON.stringify({
						url: targetUrl,
					}),
				});

				if (!response.ok) {
					const errorData = (await response.json()) as any;
					return new Response(`API Error: ${errorData.errors?.[0]?.message || response.statusText}`, { status: response.status });
				}

				const data = (await response.json()) as { success: boolean, result: string };
				
				if (data.success) {
					return new Response(data.result, {
						headers: {
							'Content-Type': 'text/markdown; charset=utf-8',
							'Access-Control-Allow-Origin': '*',
						},
					});
				} else {
					return new Response('Processing failed', { status: 500 });
				}

			} catch (error) {
				return new Response(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
			}
		}

		// Fallback for asset serving (usually handled by Wrangler anyway)
		return new Response('Not Found', { status: 404 });
	},
};
