'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Account = sequelize.define('Account', {
    accountName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
  });

  return Account;
};