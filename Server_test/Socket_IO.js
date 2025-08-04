// SERVER SIDE - Improved socket.js
const { Server } = require('socket.io');
const logger = require('./Utility/logger');
const userAgentParser = require('ua-parser-js');

let io = null;

// Map to store active sessions per URL: { url: { tvDesktop: socketId, mobiles: Set(socketIds) } }
const activeSessions = new Map();

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
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    logger.log('info', `Socket.IO client connected: ${socket.id}`);

    // Parse user agent to determine device type
    const ua = userAgentParser(socket.handshake.headers['user-agent']);
    const isMobile = ua.device.type === 'mobile' || ua.device.type === 'tablet';
    const deviceType = isMobile ? 'mobile' : 'tvDesktop';

    // Store device type in socket data
    socket.deviceType = deviceType;
    socket.joinedUrl = null;
    socket.isBeingReplaced = false; // Initialize on server for consistency

    socket.on('join', ({ url, token }, callback) => {
      try {
        if (!url) {
          const errorMsg = 'URL parameter missing';
          socket.emit('error', { message: errorMsg });
          if (callback) callback({ error: errorMsg });
          return;
        }

        // Leave previous room if joined
        if (socket.joinedUrl && socket.joinedUrl !== url) {
          socket.leave(socket.joinedUrl);
          cleanupSocketFromSessions(socket.id, socket.joinedUrl);
        }

        // Initialize session tracking for the URL if not already present
        if (!activeSessions.has(url)) {
          activeSessions.set(url, { tvDesktop: null, mobiles: new Set() });
        }

        const sessions = activeSessions.get(url);

        if (deviceType === 'tvDesktop') {
          // If a TV/desktop is already connected, disconnect it properly
          if (sessions.tvDesktop && sessions.tvDesktop !== socket.id) {
            const previousSocket = io.sockets.sockets.get(sessions.tvDesktop);
            if (previousSocket && previousSocket.connected) {
              logger.log('info', `Replacing previous TV/desktop ${sessions.tvDesktop} with ${socket.id} for URL ${url}`);

              // Mark the previous socket as being replaced
              previousSocket.isBeingReplaced = true;

              // Notify the previous socket before disconnecting
              previousSocket.emit('session_replaced', {
                message: 'This URL is now being accessed on another TV or desktop. Your session has been closed.',
                newSocketId: socket.id,
                replacedSocketId: sessions.tvDesktop
              });

              // Clean up the previous socket immediately
              previousSocket.leave(url);
              previousSocket.joinedUrl = null;
              previousSocket.disconnect(true); // Immediate disconnect (no timeout to reduce races)
              logger.log('info', `Immediately disconnected replaced socket ${sessions.tvDesktop}`);
            }

            // Clear the old session immediately
            sessions.tvDesktop = null;
          }

          // Set the new TV/desktop socket
          sessions.tvDesktop = socket.id;
          logger.log('info', `TV/Desktop ${socket.id} set for URL ${url}`);
        } else {
          // Add mobile device to the set
          sessions.mobiles.add(socket.id);
          logger.log('info', `Mobile ${socket.id} added for URL ${url}`);
        }

        socket.join(url);
        socket.joinedUrl = url;

        logger.log('info', `Client ${socket.id} (${deviceType}) joined room: ${url}`);
        logger.log('info', `Active sessions for ${url}: TV/Desktop: ${sessions.tvDesktop}, Mobiles: ${sessions.mobiles.size}`);

        if (callback) callback({ status: 'success', deviceType });
      } catch (error) {
        logger.log('error', `Error in join handler: ${error.message}`);
        if (callback) callback({ error: 'Internal server error' });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.log('info', `Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);

      // Only cleanup if this socket wasn't replaced
      if (socket.joinedUrl && !socket.isBeingReplaced) {
        cleanupSocketFromSessions(socket.id, socket.joinedUrl);
      } else if (socket.isBeingReplaced) {
        logger.log('info', `Socket ${socket.id} was replaced, skipping cleanup`);
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.log('error', `Socket error for ${socket.id}: ${error}`);
    });
  });

  // Cleanup function (unchanged)
  function cleanupSocketFromSessions(socketId, url) {
    if (!url || !activeSessions.has(url)) return;

    const sessions = activeSessions.get(url);
    let cleaned = false;

    if (sessions.tvDesktop === socketId) {
      sessions.tvDesktop = null;
      cleaned = true;
      logger.log('info', `Cleared TV/desktop session ${socketId} for URL ${url}`);
    }

    if (sessions.mobiles.has(socketId)) {
      sessions.mobiles.delete(socketId);
      cleaned = true;
      logger.log('info', `Cleared mobile session ${socketId} for URL ${url}`);
    }

    // Remove URL entry if no sessions remain
    if (!sessions.tvDesktop && sessions.mobiles.size === 0) {
      activeSessions.delete(url);
      logger.log('info', `Removed session tracking for URL ${url}`);
    } else if (cleaned) {
      logger.log('info', `Remaining sessions for ${url}: TV/Desktop: ${sessions.tvDesktop}, Mobiles: ${sessions.mobiles.size}`);
    }
  }

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
}

// Helper function to get active sessions (useful for debugging)
function getActiveSessions() {
  const sessionData = {};
  for (const [url, sessions] of activeSessions.entries()) {
    sessionData[url] = {
      tvDesktop: sessions.tvDesktop,
      mobiles: Array.from(sessions.mobiles),
      totalMobiles: sessions.mobiles.size
    };
  }
  return sessionData;
}

module.exports = { initializeSocket, getIO, getActiveSessions };
