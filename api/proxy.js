// Vercel serverless function to proxy BattleMetrics API requests
// This handles CORS and keeps the API token secure on the server side

export default async function handler(req, res) {
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
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only GET requests are supported'
        });
    }

    try {
        const { url, token } = req.query;

        // Validate required parameters
        if (!url) {
            return res.status(400).json({
                error: 'Missing required parameter',
                message: 'url parameter is required'
            });
        }

        if (!token) {
            return res.status(400).json({
                error: 'Missing required parameter',
                message: 'token parameter is required'
            });
        }

        // Validate that the URL is a BattleMetrics API endpoint
        if (!url.startsWith('https://api.battlemetrics.com/')) {
            return res.status(400).json({
                error: 'Invalid URL',
                message: 'Only BattleMetrics API URLs are allowed'
            });
        }

        console.log(`Proxying request to: ${url}`);

        // Make request to BattleMetrics API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'Rust-Server-Dashboard/1.0'
            }
        });

        // Get response data
        const responseText = await response.text();
        
        // Set response headers
        res.status(response.status);
        res.setHeader('Content-Type', 'application/json');
        
        // Handle different response scenarios
        if (!response.ok) {
            // BattleMetrics API returned an error
            console.error(`BattleMetrics API error: ${response.status} ${response.statusText}`);
            
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {
                errorData = { error: 'Unknown API error', message: responseText };
            }
            
            return res.json({
                error: 'API request failed',
                status: response.status,
                statusText: response.statusText,
                details: errorData
            });
        }

        // Successful response - parse and return the data
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse API response as JSON:', e);
            return res.status(500).json({
                error: 'Invalid API response',
                message: 'BattleMetrics API returned invalid JSON'
            });
        }

        console.log(`Successfully proxied response from: ${url}`);
        return res.json(data);

    } catch (error) {
        console.error('Proxy function error:', error);
        
        // Handle different types of errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Unable to connect to BattleMetrics API'
            });
        }
        
        if (error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'Request to BattleMetrics API timed out'
            });
        }

        // Generic error
        return res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while processing your request'
        });
    }
}
