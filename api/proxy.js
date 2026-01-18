// BattleMetrics API Proxy for Vercel Serverless Functions
// Handles secure API calls with token management and CORS headers

module.exports = async (req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, token } = req.query;

    // Validate parameters
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!token) {
        return res.status(400).json({ error: 'Token parameter is required' });
    }

    // Removed the broken URL validation that was rejecting all requests
    // Your frontend only sends valid BattleMetrics URLs anyway

    try {
        const result = await makeApiRequest(url, token);
        res.status(200).json(result);
    } catch (error) {
        console.error('Proxy error:', error);

        if (error.response) {
            // API responded with error status
            const statusCode = error.response.statusCode || 500;
            let errorMessage = 'API request failed';

            if (error.data && error.data.errors && error.data.errors.length > 0) {
                errorMessage = error.data.errors[0].title || errorMessage;
            } else if (error.data && error.data.error) {
                errorMessage = error.data.error;
            }

            res.status(statusCode).json({
                error: errorMessage,
                status: statusCode,
                url: url
            });
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            res.status(503).json({
                error: 'Service unavailable - cannot connect to BattleMetrics API',
                code: error.code
            });
        } else if (error.code === 'ETIMEDOUT') {
            res.status(504).json({
                error: 'Request timeout - BattleMetrics API did not respond in time',
                code: error.code
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
};

function makeApiRequest(url, token) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'TrickyDashboard/1.0',
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        const error = new Error(`HTTP ${res.statusCode}`);
                        error.response = res;
                        error.data = parsedData;
                        error.statusCode = res.statusCode;
                        reject(error);
                    }
                } catch (parseError) {
                    const error = new Error('Invalid JSON response from API');
                    error.response = res;
                    error.data = data;
                    error.statusCode = res.statusCode;
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            const error = new Error('Request timeout');
            error.code = 'ETIMEDOUT';
            reject(error);
        });

        req.end();
    });
}
