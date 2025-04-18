// config/config.js - Updated version
const path = require('path');

function resolveDatabasePath() {
  // If running from pkg executable
  if (process.pkg) {
    // Store database in the same directory as the executable
    return path.join(process.cwd(), 'ticker_db.sqlite');
  }
  // In development environment
  return path.join(__dirname, '..', 'ticker_db.sqlite');
}

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: resolveDatabasePath(),
    logging: (msg) => {
      if (msg.toLowerCase().includes('error')) {
        console.error(msg);
      }
    },    // Add this option to help with SQLite in pkg
    dialectOptions: {
      // SQLite-specific options
      mode: require('fs').constants.OPEN_READWRITE | 
            require('fs').constants.OPEN_CREATE
    }
  }
};