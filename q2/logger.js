const axios = require('axios');

const TEST_LOG_SERVER_URL = 'http://20.244.56.144/evaluation-service/logs'; // Replace with actual test server URL

/**
 * Sends a log to the test server.
 * @param {string} stack - The application stack (e.g., 'backend').
 * @param {string} level - Log level ('info', 'error', 'warn', 'debug').
 * @param {string} pkg - The package/module name.
 * @param {string} message - The log message.
 */
async function Log(stack, level, pkg, message) {
    try {
        await axios.post(TEST_LOG_SERVER_URL, {
            stack,
            level,
            package: pkg,
            message
        });
    } catch (err) {
        // Fallback: log to console if remote logging fails
        console.error(`[Logger Error] Could not send log: ${err.message}`);
    }
}

module.exports = { Log };