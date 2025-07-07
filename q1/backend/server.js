const express = require('express');
const crypto = require('crypto');
const { URL } = require('url');

const app = express();
app.use(express.json());

// Middleware: Console log each incoming request
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// In-memory link storage
const linkRecords = {}; 
// Format: { shortcode: { originalUrl, createdAt, expiry, clicks, clickDetails } }

// Utility: Check if a given URL string is valid
function isValidWebUrl(input) {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

// Utility: Generate a new shortcode
function createShortCode() {
  let newCode;
  do {
    newCode = crypto.randomBytes(3).toString('base64url');
  } while (linkRecords[newCode]);
  return newCode;
}

// Route: Create a short URL
// POST /shorturls
app.post('/shorturls', (req, res) => {
  const { url, validity, shortcode } = req.body;

  if (!url || !isValidWebUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL' });
  }

  let duration = parseInt(validity, 10);
  if (isNaN(duration) || duration <= 0) duration = 30;

  let finalCode = shortcode || createShortCode();

  if (shortcode && linkRecords[shortcode]) {
    return res.status(409).json({ error: 'Shortcode already in use' });
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + duration * 60000);

  linkRecords[finalCode] = {
    originalUrl: url,
    createdAt,
    expiry: expiresAt,
    clicks: 0,
    clickDetails: []
  };

  res.json({
    shortLink: `${req.protocol}://${req.get('host')}/shorturls/${finalCode}`,
    expiry: expiresAt.toISOString()
  });
});

// Route: Redirect to original URL using shortcode
// GET /shorturls/:code
app.get('/shorturls/:code', (req, res) => {
  const code = req.params.code;
  const linkData = linkRecords[code];

  if (!linkData) {
    return res.status(404).json({ error: 'Shortcode not found' });
  }

  const currentTime = new Date();
  if (currentTime > linkData.expiry) {
    return res.status(410).json({ error: 'Shortlink expired' });
  }

  // Track usage
  linkData.clicks++;
  linkData.clickDetails.push({
    timestamp: currentTime.toISOString(),
    referrer: req.get('referer') || null,
    location: req.ip
  });

  res.redirect(linkData.originalUrl);
});

// Route: Get statistics about the short URL
// GET /shorturls/:code/stats
app.get('/shorturls/:code/stats', (req, res) => {
  const code = req.params.code;
  const linkData = linkRecords[code];

  if (!linkData) {
    return res.status(404).json({ error: 'Shortcode not found' });
  }

  res.json({
    shortcode: code,
    originalUrl: linkData.originalUrl,
    createdAt: linkData.createdAt.toISOString(),
    expiry: linkData.expiry.toISOString(),
    totalClicks: linkData.clicks,
    clickDetails: linkData.clickDetails
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
