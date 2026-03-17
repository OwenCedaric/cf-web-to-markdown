export interface Env {
	BROWSER: any; // Using any to avoid Fetcher types issue if not globally defined
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_API_TOKEN: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
		const url = new URL(request.url);
		let targetUrl = url.searchParams.get('url');

		// Handle POST requests for /api/markdown
		if (!targetUrl && request.method === 'POST' && url.pathname === '/api/markdown') {
			try {
				const body = (await request.json()) as { url?: string };
				targetUrl = body.url || null;
			} catch (e) {}
		}

		// RULE: If no url parameter is present or it's empty, return 404 to let static assets take over
		if (!targetUrl || targetUrl.trim() === '') {
			return new Response('Not Found', { status: 404 });
		}

		// Cloudflare Browser Rendering API logic
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const apiToken = env.CLOUDFLARE_API_TOKEN;

		if (!accountId || !apiToken) {
			// If missing config, we return an error because the user did provide a URL
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
					body: JSON.stringify({ url: targetUrl }),
				});

				if (!response.ok) {
					// Fallback to frontend on API error
					return new Response('Not Found', { status: 404 });
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
					// Fallback to frontend on processing failure
					return new Response('Not Found', { status: 404 });
				}
			} catch (error) {
				// Fallback to frontend on network/logic error
				return new Response('Not Found', { status: 404 });
			}
	},
};
