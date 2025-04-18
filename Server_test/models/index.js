'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/config.js').development;

// Ensure the database directory exists (important for pkg)
const dbDir = path.dirname(config.storage);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize Sequelize with the configuration
const sequelize = new Sequelize(config);

const db = {
  sequelize,
  Sequelize,
  User: require('./user.js')(sequelize, Sequelize.DataTypes),
  Url: require('./url.js')(sequelize, Sequelize.DataTypes),
  Url_Content_Table: require('./url_content.js')(sequelize, Sequelize.DataTypes),
  TickerData: require('./tickerContent.js')(sequelize, Sequelize.DataTypes),
};

// Define associations
// 1. A User has many URLs, and a URL belongs to a User
db.User.hasMany(db.Url, { foreignKey: 'user_id' });
db.Url.belongsTo(db.User, { foreignKey: 'user_id' });

// 2. A URL has many content entries, and a content entry belongs to a URL
db.Url.hasMany(db.Url_Content_Table, { foreignKey: 'url_id' });
db.Url_Content_Table.belongsTo(db.Url, { foreignKey: 'url_id' });

// 3. A User has many TickerData entries, and TickerData belongs to a User
db.User.hasMany(db.TickerData, { foreignKey: 'user_id' });
db.TickerData.belongsTo(db.User, { foreignKey: 'user_id' });

// Add error handling for database connection
sequelize.authenticate()
  .then(() => {
    // console.log('Database connection established successfully.');
    return db.sequelize.sync();
  })
  .then(() => {
    // console.log('Database models synchronized successfully.');
  })
  .catch(err => {
    // console.error('Unable to connect to the database:', err);
  });

module.exports = db;