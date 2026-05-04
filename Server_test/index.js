

// // SSL 

// const express = require('express');
// const cors = require('cors');
// const authRoutes = require('./services/auth-service/routes/auth');
// const uploadRoutes = require('./services/upload-service/routes/upload');
// const os = require('os');
// const fs = require('fs');
// const path = require('path');
// const bodyParser = require('body-parser');
// const logger = require('./Utility/logger');
// const http = require('http');
// const https = require('https');
// // const WebSocket = require('ws');
// const { initializeSocket } = require('./Socket_IO'); // Import Socket.IO setup

// // Read SSL certificate and private key
// const pathToKey = path.join(process.cwd(), 'config', 'private_key.pem');
// const pathToCert = path.join(process.cwd(), 'config', 'certificate.pem');
// let privateKey, certificate;
// try {
//     privateKey = fs.readFileSync(pathToKey, 'utf8');
//     certificate = fs.readFileSync(pathToCert, 'utf8');
// } catch (error) {
//     console.error('Error loading SSL files:', error.message);
//     console.error('Ensure that private_key.pem and certificate.pem exist in the "config" directory.');
//     process.exit(1);
// }

// // Get the local IP address
// function getLocalIPAddress() {
//     const networkInterfaces = os.networkInterfaces();
//     for (const interfaceName in networkInterfaces) {
//         const addresses = networkInterfaces[interfaceName];
//         for (const address of addresses) {
//             if (address.family === 'IPv4' && !address.internal) {
//                 return address.address;
//             }
//         }
//     }
//     return '127.0.0.1';
// }
// const ipAddress = getLocalIPAddress();

// // Write IP address to config file
// const configDir = path.join(process.cwd(), 'config');
// const filePath = path.join(configDir, 'ipAddress.js');
// if (!fs.existsSync(configDir)) {
//     fs.mkdirSync(configDir, { recursive: true });
// }
// fs.writeFileSync(filePath, `module.exports = { ipAddress: '${ipAddress}' };`, 'utf8');
// logger.log(`IP Address (${ipAddress}) has been written to ${filePath}`);
// console.log(`IP Address (${ipAddress}) has been written to ${filePath}`);

// // Express app setup
// const app = express();
// const server = http.createServer(app); // Use HTTP server for WebSocket compatibility
// // const wss = new WebSocket.Server({ server }); // Initialize WebSocket server

// // CORS configuration
// const allowedOrigins = [
//     `http://122.179.140.84:4012`,
//     `https://122.179.140.84:4012`,
//     `http://122.179.140.84:86`,
//     `http://192.168.1.27:86`,
//     `http://${ipAddress}:3000`,
//     `http://${ipAddress}:3001`,
//     `http://${ipAddress}:3002`,
//     `http://${ipAddress}:3003`,
//     `http://localhost:3000`,
//     `https://welegovernance.welspun.com`,
// ];

// app.use(cors({
//     origin: (origin, callback) => {
//         if (!origin || allowedOrigins.includes(origin)) {
//             callback(null, true);
//         } else {
//             logger.log('warn', `CORS error: Origin ${origin} not allowed`);
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
// }));

// // Middleware
// app.use(express.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Serve static files
// const uploadsDir = path.resolve(process.cwd(), 'upload-service', 'Uploads');
// app.use('/', express.static(uploadsDir));

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/upload', uploadRoutes);

// // WebSocket connection handling
// // wss.on('connection', (ws) => {
// //     logger.log('info', 'WebSocket client connected');

// //     ws.on('close', () => {
// //         logger.log('info', 'WebSocket client disconnected');
// //     });

// //     ws.on('error', (error) => {
// //         logger.log('error', `WebSocket error: ${error.message}`);
// //     });
// // });

// // Broadcast function for WebSocket updates
// const broadcast = (data) => {
//     wss.clients.forEach((client) => {
//         if (client.readyState === WebSocket.OPEN) {
//             client.send(JSON.stringify(data));
//         }
//     });
// };

// // Attach broadcast function to app for use in routes
// app.set('broadcast', broadcast);

// // Initialize Socket.IO
// initializeSocket(server);

// // Error handling
// process.on('uncaughtException', (error) => {
//     logger.log('error', `Uncaught Exception: ${error.message}`);
//     process.exit(1);
// });

// process.on('unhandledRejection', (reason) => {
//     logger.log('error', `Unhandled Rejection: ${reason.message || reason}`);
//     process.exit(1);
// });

// // Start HTTP server (or HTTPS if needed)
// // const PORT = 4081;  // Production port
// const PORT = 4082;  // Development port
// server.listen(PORT, '0.0.0.0', () => {
//     console.log(`API Gateway running on http://${ipAddress}:${PORT}`);
// });

// // Optionally enable HTTPS server
// /*
// const options = {
//     key: privateKey,
//     cert: certificate,
// };
// https.createServer(options, app).listen(6069, () => {
//     console.log(`Secure server running on https://${ipAddress}:6069`);
// });
// */

// module.exports = { app, server };


// index.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./services/auth-service/routes/auth');
const uploadRoutes = require('./services/upload-service/routes/upload');
const os = require('os');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const logger = require('./Utility/logger');
const http = require('http');
const https = require('https');

const { initializeSocket, getIO } = require('./Socket_IO');


// Read SSL (kept for future HTTPS)
const pathToKey = path.join(process.cwd(), 'config', 'private_key.pem');
const pathToCert = path.join(process.cwd(), 'config', 'certificate.pem');
let privateKey, certificate;
try {
    privateKey = fs.readFileSync(pathToKey, 'utf8');
    certificate = fs.readFileSync(pathToCert, 'utf8');
} catch (error) {
    console.error('Error loading SSL files:', error.message);
    console.error('Ensure that private_key.pem and certificate.pem exist in the "config" directory.');
    process.exit(1);
}

// Get local IP
function getLocalIPAddress() {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        for (const address of addresses) {
            if (address.family === 'IPv4' && !address.internal) {
                return address.address;
            }
        }
    }
    return '127.0.0.1';
}

const ipAddress = getLocalIPAddress();

// Write IP to config
const configDir = path.join(process.cwd(), 'config');
const filePath = path.join(configDir, 'ipAddress.js');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}
fs.writeFileSync(filePath, `module.exports = { ipAddress: '${ipAddress}' };`, 'utf8');
logger.log(`IP Address (${ipAddress}) written to ${filePath}`);

// Express setup
const app = express();
const server = http.createServer(app);

// CORS - Much more flexible and correct
const allowedOrigins = [
    `http://122.179.140.84:4012`,
    `https://122.179.140.84:4012`,
    `http://122.179.140.84:86`,
    `http://192.168.1.27:86`,
    `https://welegovernance.welspun.com`,
    `http://localhost`,
    `http://${ipAddress}`,
    `http://192.168.1.27:3000`,
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Allow requests with no origin (like mobile, curl, etc.)

        const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
        if (isAllowed) {
            callback(null, true);
        } else {
            logger.log('warn', `CORS error: Origin ${origin} not allowed`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
const uploadsDir = path.resolve(process.cwd(), 'upload-service', 'Uploads');
app.use('/', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

// Initialize Socket.IO
initializeSocket(server);

// Better broadcast function using Socket.IO
const broadcast = (eventName = 'update', data) => {
    try {
        const io = getIO();
        io.emit(eventName, data);           // Send to ALL connected clients
        // If you want room-based: io.to(roomName).emit(eventName, data);
    } catch (err) {
        logger.log('error', `Broadcast failed: ${err.message}`);
    }
};

app.set('broadcast', broadcast);

// Error handling
process.on('uncaughtException', (error) => {
    logger.log('error', `Uncaught Exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.log('error', `Unhandled Rejection: ${reason}`);
    process.exit(1);
});

// Start server
const PORT = 4082;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`API Gateway running on http://${ipAddress}:${PORT}`);
});

module.exports = { app, server };