#!/usr/bin/env node

/**
 * Simple HTTP server for serving Playwright test demo pages
 * 
 * Serves the demo property inspector pages for UI testing
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const HOST = 'localhost';

// MIME types for different file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

/**
 * Get MIME type for file extension
 */
function getMimeType(filePath) {
    const ext = extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'text/plain';
}

/**
 * Serve files from the demo pages directory
 */
async function serveFile(response, filePath) {
    try {
        const content = await readFile(filePath);
        const mimeType = getMimeType(filePath);
        
        response.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Length': content.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        response.end(content);
        
    } catch (error) {
        console.error(`Error serving file ${filePath}:`, error.message);
        
        response.writeHead(404, { 'Content-Type': 'text/html' });
        response.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Not Found</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px;
                        background-color: #2d2d30;
                        color: #ffffff;
                    }
                    h1 { color: #f14c4c; }
                </style>
            </head>
            <body>
                <h1>404 - File Not Found</h1>
                <p>The requested file <code>${filePath}</code> was not found.</p>
                <p><a href="/" style="color: #007acc;">Go to homepage</a></p>
            </body>
            </html>
        `);
    }
}

/**
 * Generate homepage with links to test pages
 */
function serveHomepage(response) {
    const homepage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Govee Light Management - Test Pages</title>
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }

                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background-color: #2d2d30;
                    color: #ffffff;
                    padding: 40px 20px;
                    line-height: 1.6;
                }

                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }

                h1 {
                    color: #007acc;
                    margin-bottom: 20px;
                    text-align: center;
                }

                h2 {
                    color: #cccccc;
                    margin: 30px 0 15px 0;
                    border-bottom: 1px solid #565656;
                    padding-bottom: 10px;
                }

                .page-list {
                    list-style: none;
                    margin-bottom: 30px;
                }

                .page-item {
                    background-color: #3c3c3c;
                    border: 1px solid #565656;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    padding: 20px;
                    transition: border-color 0.2s;
                }

                .page-item:hover {
                    border-color: #007acc;
                }

                .page-link {
                    color: #007acc;
                    text-decoration: none;
                    font-size: 18px;
                    font-weight: 500;
                }

                .page-link:hover {
                    text-decoration: underline;
                }

                .page-description {
                    color: #cccccc;
                    margin-top: 8px;
                    font-size: 14px;
                }

                .feature-list {
                    list-style: none;
                    margin-top: 10px;
                }

                .feature-item {
                    color: #cccccc;
                    font-size: 13px;
                    margin: 4px 0;
                    padding-left: 20px;
                    position: relative;
                }

                .feature-item::before {
                    content: "✓";
                    color: #14a085;
                    position: absolute;
                    left: 0;
                }

                .info-section {
                    background-color: #3c3c3c;
                    border: 1px solid #565656;
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 30px;
                }

                .info-section h3 {
                    color: #14a085;
                    margin-bottom: 15px;
                }

                .info-section p {
                    color: #cccccc;
                    margin-bottom: 10px;
                }

                .code {
                    background-color: #2d2d30;
                    color: #ffffff;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Monaco', 'Menlo', monospace;
                    font-size: 12px;
                }

                .status {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    background-color: #14a085;
                    color: #ffffff;
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Govee Light Management - Test Pages</h1>
                <p style="text-align: center; color: #cccccc; margin-bottom: 40px;">
                    Demo pages for Playwright MCP UI testing of the Stream Deck plugin
                </p>

                <h2>Property Inspector Pages</h2>
                <ul class="page-list">
                    <li class="page-item">
                        <a href="/property-inspector.html" class="page-link">
                            Light Control Property Inspector
                        </a>
                        <span class="status">Ready</span>
                        <div class="page-description">
                            Configure individual light control settings including API key, device selection, and control modes.
                        </div>
                        <ul class="feature-list">
                            <li class="feature-item">API key validation and device fetching</li>
                            <li class="feature-item">Light selection with model information</li>
                            <li class="feature-item">Control modes: Toggle, On/Off, Brightness, Color, Color Temperature</li>
                            <li class="feature-item">Real-time settings preview and testing</li>
                            <li class="feature-item">Form validation and error handling</li>
                        </ul>
                    </li>

                    <li class="page-item">
                        <a href="/property-inspector-groups.html" class="page-link">
                            Group Control Property Inspector
                        </a>
                        <span class="status">Ready</span>
                        <div class="page-description">
                            Manage light groups including creation, editing, and control configuration.
                        </div>
                        <ul class="feature-list">
                            <li class="feature-item">Group selection and control modes</li>
                            <li class="feature-item">Create new groups with multiple light selection</li>
                            <li class="feature-item">Edit and delete existing groups</li>
                            <li class="feature-item">Group testing functionality</li>
                            <li class="feature-item">Real-time group management interface</li>
                        </ul>
                    </li>
                </ul>

                <div class="info-section">
                    <h3>Testing Instructions</h3>
                    <p>These pages are designed for automated UI testing with Playwright MCP. They include:</p>
                    <ul style="list-style: disc; margin-left: 20px; color: #cccccc;">
                        <li>Realistic Stream Deck property inspector styling and behavior</li>
                        <li>Mock API interactions with simulated loading states</li>
                        <li>Comprehensive form validation and error handling</li>
                        <li>Accessibility features with proper ARIA labels</li>
                        <li>Responsive design that works across different viewport sizes</li>
                    </ul>
                    
                    <h3 style="margin-top: 20px;">API Key Testing</h3>
                    <p>Use these test API keys to simulate different scenarios:</p>
                    <ul style="list-style: disc; margin-left: 20px; color: #cccccc;">
                        <li><span class="code">valid-api-key-123</span> - Successfully loads mock devices</li>
                        <li><span class="code">invalid-key</span> - Triggers validation error</li>
                        <li><span class="code">network-error-key</span> - Simulates network failure</li>
                    </ul>
                    
                    <h3 style="margin-top: 20px;">Running Tests</h3>
                    <p>Start the Playwright tests with: <span class="code">npm run test:e2e</span></p>
                    <p>The tests will automatically use these pages to validate UI functionality.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    response.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    response.end(homepage);
}

/**
 * Main request handler
 */
function handleRequest(request, response) {
    const url = new URL(request.url, `http://${HOST}:${PORT}`);
    let pathname = url.pathname;

    // Log request
    console.log(`${new Date().toISOString()} - ${request.method} ${pathname}`);

    // Serve homepage
    if (pathname === '/' || pathname === '/index.html') {
        serveHomepage(response);
        return;
    }

    // Remove leading slash and map to demo pages directory
    if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
    }

    const filePath = join(__dirname, '../demo-pages', pathname);
    serveFile(response, filePath);
}

/**
 * Create and start the server
 */
const server = createServer(handleRequest);

server.listen(PORT, HOST, () => {
    console.log(`🚀 Test server running at http://${HOST}:${PORT}`);
    console.log('📄 Available test pages:');
    console.log(`   • http://${HOST}:${PORT}/property-inspector.html`);
    console.log(`   • http://${HOST}:${PORT}/property-inspector-groups.html`);
    console.log('');
    console.log('🧪 Ready for Playwright MCP testing!');
    console.log('   Run: npm run test:e2e');
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down test server...');
    server.close(() => {
        console.log('✅ Test server stopped');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down test server...');
    server.close(() => {
        console.log('✅ Test server stopped');
        process.exit(0);
    });
});

export default server;