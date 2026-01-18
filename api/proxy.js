// Fixed BattleMetrics Proxy for Vercel (CommonJS format)
const https = require('https');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, token } = req.query;

    if (!url || !token) {
        return res.status(400).json({ error: 'Missing url or token' });
    }

    // No URL validation - frontend only sends BattleMetrics URLs

    try {
        const decodedUrl = decodeURIComponent(url);
        const response = await fetch(decodedUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TrickyDashboard/1.0'
            },
            timeout: 15000
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'BattleMetrics API error',
                status: response.status,
                details: data
            });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            error: 'Proxy failed',
            message: error.message
        });
    }
};
