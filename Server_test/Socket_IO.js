// const { Server } = require('socket.io');
// const logger = require('./Utility/logger');

// let io = null;

// const allowedOrigins = [
//   `http://122.179.140.84:4012`,
//   `http://122.179.140.84:86`,
//   `http://${require('./config/ipAddress').ipAddress}:3000`,
//   `http://${require('./config/ipAddress').ipAddress}:3001`,
//   `http://${require('./config/ipAddress').ipAddress}:3002`,
//   `http://${require('./config/ipAddress').ipAddress}:3003`,
//   `localhost:4082`,
//   `localhost:3000`,
// ];

// function initializeSocket(server) {
//   io = new Server(server, {
//     cors: {
//       origin: (origin, callback) => {
//         if (!origin || allowedOrigins.includes(origin)) {
//           callback(null, true);
//         } else {
//           logger.log('warn', `Socket.IO CORS error: Origin ${origin} not allowed`);
//           callback(new Error('Not allowed by CORS'));
//         }
//       },
//       methods: ['GET', 'POST'],
//     },
//   });

//   io.on('connection', (socket) => {
//     logger.log('info', `Socket.IO client connected: ${socket.id}`);

//     socket.on('join', ({ url, token }, callback) => {
//       if (!url) {
//         socket.emit('error', { message: 'URL parameter missing' });
//         callback({ error: 'URL parameter missing' });
//         return;
//       }

//       socket.join(url);
//       logger.log('info', `Client ${socket.id} joined room: ${url}`);
//       callback({ status: 'success' });
//     });

//     socket.on('disconnect', () => {
//       logger.log('info', `Socket.IO client disconnected: ${socket.id}`);
//     });
//   });

//   return io;
// }

// function getIO() {
//   if (!io) {
//     throw new Error('Socket.IO not initialized. Call initializeSocket first.');
//   }
//   return io;
// }

// module.exports = { initializeSocket, getIO };


// Socket_IO.js
const { Server } = require('socket.io');
const logger = require('./Utility/logger');

let io = null;

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);

                const allowed = [
                    `http://122.179.140.84:4012`,
                    `https://122.179.140.84:4012`,
                    `http://122.179.140.84:86`,
                    `http://192.168.1.27:86`,
                    `https://welegovernance.welspun.com`,
                    `http://localhost`,
                    `http://127.0.0.1`,
                ];

                const isAllowed = allowed.some(a => origin.startsWith(a));
                if (isAllowed) {
                    callback(null, true);
                } else {
                    logger.log('warn', `Socket.IO CORS error: Origin ${origin} not allowed`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling']   // Explicitly allow both
    });

    io.on('connection', (socket) => {
        logger.log('info', `Socket.IO client connected: ${socket.id}`);

        socket.on('join', ({ url, token }, callback) => {
            if (!url) {
                const errorMsg = 'URL parameter missing';
                socket.emit('error', { message: errorMsg });
                if (typeof callback === 'function') callback({ error: errorMsg });
                return;
            }

            socket.join(url);
            logger.log('info', `Client ${socket.id} joined room: ${url}`);

            if (typeof callback === 'function') {
                callback({ status: 'success' });
            }
        });

        socket.on('disconnect', () => {
            logger.log('info', `Socket.IO client disconnected: ${socket.id}`);
        });
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
}

module.exports = { initializeSocket, getIO };