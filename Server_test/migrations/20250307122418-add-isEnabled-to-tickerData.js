module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ticker_data', 'isEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: true, // Allows NULL values
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ticker_data', 'isEnabled');
  }
};
