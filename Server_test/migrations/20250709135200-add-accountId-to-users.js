'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create a default account
    await queryInterface.bulkInsert('Accounts', [{
      accountName: 'DefaultAccount',
      createdBy: 1, // Adjust if you have a known user ID, or set to null temporarily
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    // Get the ID of the default account
    const [defaultAccount] = await queryInterface.sequelize.query(
      "SELECT id FROM Accounts WHERE accountName = 'DefaultAccount'"
    );

    // Add accountId column
    await queryInterface.addColumn('Users', 'accountId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Accounts',
        key: 'id',
      },
      defaultValue: defaultAccount[0].id, // Set default for existing rows
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'accountId');
    await queryInterface.bulkDelete('Accounts', { accountName: 'DefaultAccount' }, {});
  },
};