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
const authRoutes = require('./services/auth-service/routes/auth'); // Ensure this path is correct
const uploadRoutes = require('./services/upload-service/routes/upload'); // Ensure this path is correct
const os = require('os');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const logger = require('./Utility/logger'); // Import logger
const https = require('https');
const http = require('http');
const pathToKey = path.join(process.cwd(), 'config', 'private_key.pem');
const pathToCert = path.join(process.cwd(), 'config', 'certificate.pem');
// Read SSL certificate and private key
let privateKey, certificate;
try {
  privateKey = fs.readFileSync(pathToKey, 'utf8');
  certificate = fs.readFileSync(pathToCert, 'utf8');
} catch (error) {
  console.error('Error loading SSL files:', error.message);
  console.error('Ensure that private_key.pem and certificate.pem exist in the "config" directory.');
  process.exit(1); // Exit if SSL files are not found
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
  return '127.0.0.1'; // Default fallback IP address
}
const ipAddress = getLocalIPAddress();
// Use a writable location instead of __dirname
const configDir = path.join(process.cwd(), 'config'); // Or use os.homedir(), os.tmpdir(), etc.
const filePath = path.join(configDir, 'ipAddress.js');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}
fs.writeFileSync(filePath, `module.exports = { ipAddress: '${ipAddress}' };`, 'utf8');
logger.log(`IP Address (${ipAddress}) has been written to ${filePath}`);
console.log(`IP Address (${ipAddress}) has been written to ${filePath}`);
// Express app setup
const app = express();
const allowedOrigins = [
  `http://122.179.140.84:4012`,
  `http://122.179.140.84:86`,
  `http://192.168.1.27:86`,
  `http://${ipAddress}:3000`,
  `http://${ipAddress}:3001`,
  `http://${ipAddress}:3002`,
  `http://${ipAddress}:3003`,
];
// Middleware
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
app.use(express.json());
// Routing
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
process.on('uncaughtException', (error) => {
  logger.log('error', `Uncaught Exception: ${error.message}`);
  process.exit(1); // Exit the process to avoid unpredictable behavior
});
process.on('unhandledRejection', (reason) => {
  logger.log('error', `Unhandled Rejection: ${reason.message || reason}`);
  process.exit(1); // Exit the process to avoid unpredictable behavior
});
// Serve static files
const uploadsDir = path.resolve(process.cwd(), 'upload-service', 'uploads');
app.use('/', express.static(uploadsDir));
// Log the path for debugging
app.use(bodyParser.urlencoded({ extended: true }));
const options = {
  key: privateKey,
  cert: certificate,
};
// Start HTTPS server
// https.createServer(options, app).listen(6069, () => {
//   console.log('Secure server running on https://localhost:6069');
// });
const PORT = 4011;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${PORT}`);
});
