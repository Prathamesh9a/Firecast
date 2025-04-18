'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ticker_data', 'scheduledAt', {
      type: Sequelize.DATE,
      allowNull: true, // Allow null values
    });

    await queryInterface.addColumn('ticker_data', 'expiresAt', {
      type: Sequelize.DATE,
      allowNull: true, // Allow null values
    });
  },
  

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ticker_data', 'scheduledAt');
    await queryInterface.removeColumn('ticker_data', 'expiresAt');
  },
};