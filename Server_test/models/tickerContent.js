module.exports = (sequelize, DataTypes) => {
  const TickerData = sequelize.define('ticker_data', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false, // Ensure user_id cannot be null
      references: {
        model: 'users', // Name of the target table (users)
        key: 'id',      // Key in the User table that TickerData will reference
      },
    },
    url_content: {
      type: DataTypes.JSONB,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Url_Name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isEnabled:
    {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    custom_ticker: {
      type: DataTypes.STRING,
      allowNull: true
    },
    settings: { // New column to store settings
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        ticker: {
          speed: 500,
          height: 50,
          fontSize: 16,
          visible: true,
        },
        dateTime: {
          position: "top-right",
          visible: true,
        },
        temperature: {
          position: "top-left",
          visible: true,
        },
      },
    },
  });

  // Associate the TickerData model with the User model
  TickerData.associate = (models) => {
    TickerData.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return TickerData;
};
