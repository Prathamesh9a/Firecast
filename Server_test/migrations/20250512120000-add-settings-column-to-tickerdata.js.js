'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ticker_data', 'settings', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {
        ticker: {
          speed: 30,
          height: 48,
          fontSize: 16,
          visible: true,
        },
        dateTime: {
          position: "top-right",
          visible: true,
        },
        temperature: {
          position: "bottom-left",
          visible: true,
        },
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ticker_data', 'settings');
  },
};