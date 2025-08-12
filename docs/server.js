#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DOCS_DIR = __dirname;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <head><title>404 Not Found</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h1>404 - File Not Found</h1>
                        <p>The requested file could not be found.</p>
                        <a href="/">← Back to Documentation</a>
                    </body>
                </html>
            `);
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, { 
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    // Parse URL and remove query parameters
    let requestPath = req.url.split('?')[0];
    
    // Remove trailing slash
    if (requestPath.endsWith('/') && requestPath.length > 1) {
        requestPath = requestPath.slice(0, -1);
    }
    
    // Default to index.html for root path
    if (requestPath === '/' || requestPath === '') {
        requestPath = '/index.html';
    }
    
    // Construct full file path
    const filePath = path.join(DOCS_DIR, requestPath);
    
    // Security check: ensure the path is within the docs directory
    const resolvedPath = path.resolve(filePath);
    const resolvedDocsDir = path.resolve(DOCS_DIR);
    
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <head><title>403 Forbidden</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>403 - Access Forbidden</h1>
                    <p>Access to this path is not allowed.</p>
                    <a href="/">← Back to Documentation</a>
                </body>
            </html>
        `);
        return;
    }
    
    // Check if file exists
    fs.stat(resolvedPath, (err, stats) => {
        if (err) {
            // If file doesn't exist, serve 404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <head><title>404 Not Found</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h1>404 - Page Not Found</h1>
                        <p>The requested page could not be found.</p>
                        <a href="/">← Back to Documentation</a>
                    </body>
                </html>
            `);
            return;
        }
        
        if (stats.isDirectory()) {
            // If it's a directory, try to serve index.html
            const indexPath = path.join(resolvedPath, 'index.html');
            fs.stat(indexPath, (indexErr) => {
                if (indexErr) {
                    // No index.html in directory, show directory listing
                    fs.readdir(resolvedPath, (dirErr, files) => {
                        if (dirErr) {
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <head><title>500 Internal Error</title></head>
                                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                        <h1>500 - Internal Server Error</h1>
                                        <p>Could not read directory.</p>
                                        <a href="/">← Back to Documentation</a>
                                    </body>
                                </html>
                            `);
                            return;
                        }
                        
                        const filesList = files.map(file => 
                            `<li><a href="${requestPath}/${file}">${file}</a></li>`
                        ).join('');
                        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <head><title>Directory: ${requestPath}</title></head>
                                <body style="font-family: Arial, sans-serif; padding: 20px;">
                                    <h1>Directory: ${requestPath}</h1>
                                    <ul>${filesList}</ul>
                                    <hr>
                                    <a href="/">← Back to Documentation</a>
                                </body>
                            </html>
                        `);
                    });
                } else {
                    // Serve index.html from directory
                    serveFile(indexPath, res);
                }
            });
        } else {
            // It's a file, serve it
            serveFile(resolvedPath, res);
        }
    });
});

server.listen(PORT, 'localhost', () => {
    console.log('🌟 RP9 Phase 5 Documentation Server');
    console.log('====================================');
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${DOCS_DIR}`);
    console.log('');
    console.log('📖 Available pages:');
    console.log('   • http://localhost:3001/ - Main documentation');
    console.log('   • http://localhost:3001/PHASE5_ONBOARDING_USAGE.md - Technical docs');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('====================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down documentation server...');
    server.close(() => {
        console.log('✅ Server stopped successfully');
        process.exit(0);
    });
});

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please close other applications using this port or use a different port.`);
    } else {
        console.error('❌ Server error:', err.message);
    }
    process.exit(1);
});