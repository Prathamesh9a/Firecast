const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

// ✅ Ensure logs are created outside the snapshot
const baseLogsDir = path.join(process.cwd(), 'logs'); // Change __dirname to process.cwd()

// Ensure base logs directory exists
if (!fs.existsSync(baseLogsDir)) {
  fs.mkdirSync(baseLogsDir, { recursive: true });
}

// ✅ Error Logs - Weekly Rotation
function getWeekStartDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

function getErrorLogFilePath() {
  const weekStart = getWeekStartDate();
  const errorLogsDir = path.join(baseLogsDir, 'errorLogs'); // Save logs in a writable location
  if (!fs.existsSync(errorLogsDir)) {
    fs.mkdirSync(errorLogsDir, { recursive: true });
  }
  return path.join(errorLogsDir, `error_${weekStart}.log`);
}

function log(level, message) {
  const logFilePath = getErrorLogFilePath();
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
}

// ✅ User Activity Logs - Weekly Rotation
const userActivityLogsDir = path.join(baseLogsDir, 'userActivityLogs');
if (!fs.existsSync(userActivityLogsDir)) {
  fs.mkdirSync(userActivityLogsDir, { recursive: true });
}

const userActivityTransport = new winston.transports.DailyRotateFile({
  dirname: userActivityLogsDir,
  filename: 'userActivity-%DATE%.log',
  datePattern: 'YYYY-ww',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '5w',
});

const userActivityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [userActivityTransport],
});

function logUserActivity(method, apiName, additionalInfo = {}) {
  const logEntry = { method, apiName, ...additionalInfo };
  userActivityLogger.info(logEntry);
}

// ✅ Handle Uncaught Errors
process.on('uncaughtException', (error) => {
  log('error', `Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled Rejection: ${reason.message || reason}`);
  process.exit(1);
});

module.exports = { log, logUserActivity };
