// const express = require('express');
// const cors = require('cors');
// const authRoutes = require('./services/auth-service/routes/auth');
// const uploadRoutes = require('./services/upload-service/routes/upload');
// const os = require('os');
// const fs = require('fs');
// const path = require('path');
// const bodyParser = require('body-parser');
// const logger = require('./Utility/logger');
// const https = require('https');
// const http = require('http');
// const cluster = require('cluster');

// // Get number of CPUs for clustering
// const numCPUs = os.cpus().length;

// // Clustering implementation
// if (cluster.isMaster) {
//   logger.log(`Master process ${process.pid} is running`);
//   console.log(`Master process ${process.pid} is running`);

//   // Fork workers based on CPU count
//   // for (let i = 0; i < numCPUs; i++) {
//   for (let i = 0; i < 4; i++) {
//     cluster.fork();
//   }

//   // Handle worker crashes and restart them
//   cluster.on('exit', (worker, code, signal) => {
//     logger.log(`Worker ${worker.process.pid} died with code: ${code} and signal: ${signal}`);
//     console.log(`Worker ${worker.process.pid} died - restarting...`);
//     cluster.fork(); // Replace the dead worker
//   });
// } else {
//   // Worker processes share the same port

//   // Get the local IP address
//   function getLocalIPAddress() {
//     const networkInterfaces = os.networkInterfaces();
//     for (const interfaceName in networkInterfaces) {
//       const addresses = networkInterfaces[interfaceName];
//       for (const address of addresses) {
//         if (address.family === 'IPv4' && !address.internal) {
//           return address.address;
//         }
//       }
//     }
//     return '127.0.0.1'; // Default fallback IP address
//   }

//   const ipAddress = getLocalIPAddress();

//   // Use a writable location
//   const configDir = path.join(process.cwd(), 'config');
//   const filePath = path.join(configDir, 'ipAddress.js');

//   if (!fs.existsSync(configDir)) {
//     fs.mkdirSync(configDir, { recursive: true });
//   }

//   // Only let the first worker write the file to avoid conflicts
//   if (cluster.worker.id === 1) {
//     fs.writeFileSync(filePath, `module.exports = { ipAddress: '${ipAddress}' };`, 'utf8');
//     logger.log(`IP Address (${ipAddress}) has been written to ${filePath}`);
//   }

//   // Read SSL certificate and private key
//   let privateKey, certificate;
//   try {
//     const pathToKey = path.join(process.cwd(), 'config', 'private_key.pem');
//     const pathToCert = path.join(process.cwd(), 'config', 'certificate.pem');
//     privateKey = fs.readFileSync(pathToKey, 'utf8');
//     certificate = fs.readFileSync(pathToCert, 'utf8');
//   } catch (error) {
//     logger.log('error', `Error loading SSL files: ${error.message}`);
//     console.error('Error loading SSL files:', error.message);
//     console.error('Ensure that private_key.pem and certificate.pem exist in the "config" directory.');
//     process.exit(1);
//   }

//   // Express app setup
//   const app = express();

//   const allowedOrigins = [
//     `http://122.179.140.84:4012`,
//     `http://${ipAddress}:3000`
//     `http://${ipAddress}:3001`
//   ];

//   // Middleware
//   app.use(cors({
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         logger.log('warn', `CORS error: Origin ${origin} not allowed`);
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//   }));

//   app.use(express.json());
//   app.use(bodyParser.urlencoded({ extended: true }));

//   // Routing
//   app.use('/api/auth', authRoutes);
//   app.use('/api/upload', uploadRoutes);

//   // Serve static files
//   const uploadsDir = path.resolve(process.cwd(), 'upload-service', 'uploads');
//   app.use('/', express.static(uploadsDir));

//   // Error handling
//   process.on('uncaughtException', (error) => {
//     logger.log('error', `Uncaught Exception in worker ${process.pid}: ${error.message}`);
//     process.exit(1);
//   });

//   process.on('unhandledRejection', (reason) => {
//     logger.log('error', `Unhandled Rejection in worker ${process.pid}: ${reason.message || reason}`);
//     process.exit(1);
//   });

//   // HTTPS configuration
//   const options = {
//     key: privateKey,
//     cert: certificate,
//   };

//   // Start HTTP server (you can uncomment HTTPS if needed)
//   const PORT = 777;
//   // For HTTPS:
//   // https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
//   //   logger.log(`Worker ${process.pid} - Secure API Gateway running on port ${PORT}`);
//   //   console.log(`Worker ${process.pid} - Secure API Gateway running on port ${PORT}`);
//   // });

//   // For HTTP:
//   app.listen(PORT, '0.0.0.0', () => {
//     logger.log(`Worker ${process.pid} - API Gateway running on port ${PORT}`);
//     console.log(`Worker ${process.pid} - API Gateway running on port ${PORT}`);
//   });

//   logger.log(`Worker ${process.pid} started`);
// }


// SSL 

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
const WebSocket = require('ws');

// Read SSL certificate and private key
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

// Get the local IP address
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

// Write IP address to config file
const configDir = path.join(process.cwd(), 'config');
const filePath = path.join(configDir, 'ipAddress.js');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}
fs.writeFileSync(filePath, `module.exports = { ipAddress: '${ipAddress}' };`, 'utf8');
logger.log(`IP Address (${ipAddress}) has been written to ${filePath}`);
console.log(`IP Address (${ipAddress}) has been written to ${filePath}`);

// Express app setup
const app = express();
const server = http.createServer(app); // Use HTTP server for WebSocket compatibility
const wss = new WebSocket.Server({ server }); // Initialize WebSocket server

// CORS configuration
const allowedOrigins = [
    `http://122.179.140.84:4012`,
    `https://122.179.140.84:4012`,
    `http://122.179.140.84:86`,
    `http://192.168.1.27:86`,
    `http://${ipAddress}:3000`,
    `http://${ipAddress}:3001`,
    `http://${ipAddress}:3002`,
    `http://${ipAddress}:3003`,
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.log('warn', `CORS error: Origin ${origin} not allowed`);
            callback(new Error('Not allowed by CORS'));
        }
    },
}));

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
const uploadsDir = path.resolve(process.cwd(), 'upload-service', 'Uploads');
app.use('/', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

// WebSocket connection handling
wss.on('connection', (ws) => {
    logger.log('info', 'WebSocket client connected');

    ws.on('close', () => {
        logger.log('info', 'WebSocket client disconnected');
    });

    ws.on('error', (error) => {
        logger.log('error', `WebSocket error: ${error.message}`);
    });
});

// Broadcast function for WebSocket updates
const broadcast = (data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

// Attach broadcast function to app for use in routes
app.set('broadcast', broadcast);

// Error handling
process.on('uncaughtException', (error) => {
    logger.log('error', `Uncaught Exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.log('error', `Unhandled Rejection: ${reason.message || reason}`);
    process.exit(1);
});

// D:\Firecast USA\Firecast\Server_test\upload-service\uploads\stifflera@welspunusa.com\test121\SampleJPGImage_1mbmb.jpg
// Start HTTP server (or HTTPS if needed)
const PORT = 4081;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`API Gateway running on http://${ipAddress}:${PORT}`);
});

// Optionally enable HTTPS server
/*
const options = {
    key: privateKey,
    cert: certificate,
};
https.createServer(options, app).listen(6069, () => {
    console.log(`Secure server running on https://${ipAddress}:6069`);
});
*/

module.exports = { app, server };

// const express = require('express');
// const cors = require('cors');
// const authRoutes = require('./services/auth-service/routes/auth');
// const uploadRoutes = require('./services/upload-service/routes/upload');
// const os = require('os');
// const fs = require('fs');
// const path = require('path');
// const bodyParser = require('body-parser');
// const logger = require('./Utility/logger');
// const http = require('http'); // ✅ HTTP server for API + WebSocket
// const WebSocket = require('ws'); // ✅ WebSocket library

// // Get the local IP address
// function getLocalIPAddress() {
//   const networkInterfaces = os.networkInterfaces();
//   for (const interfaceName in networkInterfaces) {
//     const addresses = networkInterfaces[interfaceName];
//     for (const address of addresses) {
//       if (address.family === 'IPv4' && !address.internal) {
//         return address.address;
//       }
//     }
//   }
//   return '127.0.0.1';
// }
// const ipAddress = getLocalIPAddress();

// // Write IP address to file
// const configDir = path.join(process.cwd(), 'config');
// const filePath = path.join(configDir, 'ipAddress.js');
// if (!fs.existsSync(configDir)) {
//   fs.mkdirSync(configDir, { recursive: true });
// }
// fs.writeFileSync(filePath, `module.exports = { ipAddress: '${ipAddress}' };`, 'utf8');
// logger.log(`IP Address (${ipAddress}) has been written to ${filePath}`);
// console.log(`IP Address (${ipAddress}) has been written to ${filePath}`);

// // Express app setup
// const app = express();

// // CORS setup
// const allowedOrigins = [
//   `http://122.179.140.84:4012`,
//   `http://122.179.140.84:86`,
//   `http://192.168.1.27:86`,
//   `http://${ipAddress}:3000`,
//   `http://${ipAddress}:3001`,
//   `http://${ipAddress}:3002`,
//   `http://${ipAddress}:3003`,
// ];
// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       logger.log('warn', `CORS error: Origin ${origin} not allowed`);
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
// }));
// app.use(express.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Routing
// app.use('/api/auth', authRoutes);
// app.use('/api/upload', uploadRoutes);

// // Serve static files
// const uploadsDir = path.resolve(process.cwd(), 'upload-service', 'uploads');
// app.use('/', express.static(uploadsDir));

// // Handle uncaught errors
// process.on('uncaughtException', (error) => {
//   logger.log('error', `Uncaught Exception: ${error.message}`);
//   process.exit(1);
// });
// process.on('unhandledRejection', (reason) => {
//   logger.log('error', `Unhandled Rejection: ${reason.message || reason}`);
//   process.exit(1);
// });

// // HTTP server creation ✅
// const PORT = 4069;
// const httpServer = http.createServer(app);

// // ✅ WebSocket server setup attached to HTTP server
// const wss = new WebSocket.Server({ server: httpServer });

// wss.on('connection', (ws) => {
//   console.log('🔌 New WebSocket client connected');

//   ws.on('message', (message) => {
//     console.log(`📩 Received: ${message}`);
//     ws.send(`✅ Server received: ${message}`);
//   });

//   ws.on('close', () => {
//     console.log('❌ Client disconnected');
//   });
// });

// // ✅ Start the HTTP + WebSocket server
// httpServer.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 API Gateway + WebSocket server running on port ${PORT}`);
// });
