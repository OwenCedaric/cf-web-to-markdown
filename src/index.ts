export interface Env {
	BROWSER: Fetcher;
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_API_TOKEN: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
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

		// If no URL is provided, serve the frontend
		if (!targetUrl) {
			return new Response(getHtml(), {
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			});
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
	},
};

function getHtml() {
	return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web to Markdown - 网页转 Markdown</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --bg: #0f172a;
            --card-bg: #1e293b;
            --text: #f8fafc;
            --text-dim: #94a3b8;
            --border: #334155;
            --success: #10b981;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.6;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            padding: 2rem 1rem;
        }

        .container {
            width: 100%;
            max-width: 900px;
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
            animation: fadeInDown 0.8s ease-out;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 3rem;
            font-weight: 600;
            background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }

        p.subtitle {
            color: var(--text-dim);
            font-size: 1.1rem;
        }

        .card {
            background-color: var(--card-bg);
            border-radius: 1.5rem;
            padding: 2.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border);
            backdrop-filter: blur(10px);
            animation: fadeInUp 0.8s ease-out;
        }

        .input-group {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
        }

        input {
            flex: 1;
            background: #0f172a;
            border: 1px solid var(--border);
            padding: 1rem 1.5rem;
            border-radius: 1rem;
            color: var(--text);
            font-size: 1rem;
            transition: all 0.3s ease;
            outline: none;
        }

        input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
        }

        button {
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'Outfit', sans-serif;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        button:hover {
            background-color: var(--primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);
        }

        button:active {
            transform: translateY(0);
        }

        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        #result-container {
            display: none;
            margin-top: 2rem;
            animation: fadeIn 0.5s ease-out;
        }

        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .result-title {
            font-weight: 600;
            color: var(--text-dim);
            text-transform: uppercase;
            font-size: 0.875rem;
            letter-spacing: 0.05em;
        }

        pre {
            background-color: #0f172a;
            padding: 1.5rem;
            border-radius: 1rem;
            overflow-x: auto;
            border: 1px solid var(--border);
            max-height: 500px;
            font-family: 'Fira Code', 'Monaco', monospace;
            font-size: 0.9rem;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .copy-btn {
            background: transparent;
            border: 1px solid var(--border);
            padding: 0.5rem 1rem;
            font-size: 0.8rem;
        }

        .copy-btn:hover {
            background: var(--border);
            transform: none;
            box-shadow: none;
        }

        .status {
            margin-top: 1rem;
            text-align: center;
            font-size: 0.9rem;
            min-height: 1.5rem;
        }

        .error { color: #f87171; }
        .success { color: var(--success); }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .loader {
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            display: none;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
            .input-group { flex-direction: column; }
            h1 { font-size: 2rem; }
            .card { padding: 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Web to Markdown</h1>
            <p class="subtitle">输入网址，瞬间转换为干净的 Markdown 格式</p>
        </header>

        <main class="card">
            <div class="input-group">
                <input type="url" id="url-input" placeholder="https://example.com" required>
                <button id="convert-btn">
                    <span class="loader" id="loader"></span>
                    <span id="btn-text">转换</span>
                </button>
            </div>

            <div id="status" class="status"></div>

            <div id="result-container">
                <div class="result-header">
                    <span class="result-title">Markdown 结果</span>
                    <button class="copy-btn" id="copy-btn">复制内容</button>
                </div>
                <pre id="result-content"></pre>
            </div>
        </main>
    </div>

    <script>
        const urlInput = document.getElementById('url-input');
        const convertBtn = document.getElementById('convert-btn');
        const loader = document.getElementById('loader');
        const btnText = document.getElementById('btn-text');
        const status = document.getElementById('status');
        const resultContainer = document.getElementById('result-container');
        const resultContent = document.getElementById('result-content');
        const copyBtn = document.getElementById('copy-btn');

        convertBtn.addEventListener('click', async () => {
            const targetUrl = urlInput.value.trim();
            if (!targetUrl) {
                showStatus('请输入有效的网址', 'error');
                return;
            }

            setLoading(true);
            showStatus('正在处理，请稍候...', 'info');
            resultContainer.style.display = 'none';

            try {
                const response = await fetch('/?url=' + encodeURIComponent(targetUrl));
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(error);
                }

                const markdown = await response.text();
                resultContent.textContent = markdown;
                resultContainer.style.display = 'block';
                showStatus('转换成功！', 'success');
            } catch (err) {
                showStatus('转换失败: ' + err.message, 'error');
            } finally {
                setLoading(false);
            }
        });

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(resultContent.textContent).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = '已复制！';
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            });
        });

        function setLoading(isLoading) {
            convertBtn.disabled = isLoading;
            loader.style.display = isLoading ? 'block' : 'none';
            btnText.style.display = isLoading ? 'none' : 'block';
        }

        function showStatus(msg, type) {
            status.textContent = msg;
            status.className = 'status ' + type;
        }
    </script>
</body>
</html>
	`;
}
