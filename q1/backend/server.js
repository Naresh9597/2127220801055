const express = require('express');
const crypto = require('crypto');
const { URL } = require('url');
const { Log } = require('./logger');

const app = express();
app.use(express.json());

// Logging middleware for requests
app.use(async (req, res, next) => {
    await Log('backend', 'info', 'middleware', `Incoming ${req.method} ${req.url}`);
    next();
});

// POST /shorturls - Create short URL
app.post('/shorturls', async (req, res) => {
    let { url, validity, shortcode } = req.body;

    if (!url || !isValidUrl(url)) {
        await Log('backend', 'error', 'shorturl', 'Invalid or missing URL');
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    let validityMins = parseInt(validity, 10);
    if (isNaN(validityMins) || validityMins <= 0) validityMins = 30;

    if (shortcode) {
        if (urlDatabase[shortcode]) {
            await Log('backend', 'warn', 'shorturl', `Shortcode conflict: ${shortcode}`);
            return res.status(409).json({ error: 'Shortcode already in use' });
        }
    } else {
        shortcode = generateShortCode();
    }

    const createdAt = new Date();
    const expiry = new Date(createdAt.getTime() + validityMins * 60000);

    urlDatabase[shortcode] = {
        originalUrl: url,
        createdAt,
        expiry,
        clicks: 0,
        clickDetails: []
    };

    await Log('backend', 'info', 'shorturl', `Short URL created: ${shortcode}`);

    res.json({
        shortLink: `${req.protocol}://${req.get('host')}/shorturls/${shortcode}`,
        expiry: expiry.toISOString()
    });
});

// GET /shorturls/:code - Redirect and log click
app.get('/shorturls/:code', async (req, res) => {
    const entry = urlDatabase[req.params.code];
    if (!entry) {
        await Log('backend', 'warn', 'redirect', `Shortcode not found: ${req.params.code}`);
        return res.status(404).json({ error: 'Shortcode not found' });
    }

    const now = new Date();
    if (now > entry.expiry) {
        await Log('backend', 'info', 'redirect', `Shortlink expired: ${req.params.code}`);
        return res.status(410).json({ error: 'Shortlink expired' });
    }

    entry.clicks += 1;
    entry.clickDetails.push({
        timestamp: now.toISOString(),
        referrer: req.get('referer') || null,
        location: req.ip
    });

    await Log('backend', 'info', 'redirect', `Redirected: ${req.params.code} to ${entry.originalUrl}`);

    res.redirect(entry.originalUrl);
});

// GET /shorturls/:code/stats - Usage statistics
app.get('/shorturls/:code/stats', async (req, res) => {
    const entry = urlDatabase[req.params.code];
    if (!entry) {
        await Log('backend', 'warn', 'stats', `Stats requested for missing shortcode: ${req.params.code}`);
        return res.status(404).json({ error: 'Shortcode not found' });
    }

    await Log('backend', 'info', 'stats', `Stats retrieved for shortcode: ${req.params.code}`);

    res.json({
        shortcode: req.params.code,
        originalUrl: entry.originalUrl,
        createdAt: entry.createdAt.toISOString(),
        expiry: entry.expiry.toISOString(),
        totalClicks: entry.clicks,
        clickDetails: entry.clickDetails
    });
});

// Error handler
app.use(async (err, req, res, next) => {
    await Log('backend', 'error', 'handler', err.stack || err.message);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});