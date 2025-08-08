const { Server } = require('socket.io');
const logger = require('./Utility/logger');

let io = null;

const allowedOrigins = [
  `http://192.168.1.21`,
  `http://192.168.1.17:3000`,
  `http://122.179.140.84:4012`,
  `http://122.179.140.84:86`,
  `http://${require('./config/ipAddress').ipAddress}:3000`,
  `http://${require('./config/ipAddress').ipAddress}:3001`,
  `http://${require('./config/ipAddress').ipAddress}:3002`,
  `http://${require('./config/ipAddress').ipAddress}:3003`,
];

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.log('warn', `Socket.IO CORS error: Origin ${origin} not allowed`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.log('info', `Socket.IO client connected: ${socket.id}`);

    socket.on('join', ({ url, token }, callback) => {
      if (!url) {
        socket.emit('error', { message: 'URL parameter missing' });
        callback({ error: 'URL parameter missing' });
        return;
      }

      socket.join(url);
      logger.log('info', `Client ${socket.id} joined room: ${url}`);
      callback({ status: 'success' });
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