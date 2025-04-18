module.exports = (sequelize, DataTypes) => {
    const Url = sequelize.define('Url', {
      url_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      url_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', // Table name of the User model
          key: 'id' // Foreign key is the id of the User model
        }
      }
    });
  
    Url.associate = function(models) {
      // Define association to User model
      Url.belongsTo(models.User, {
        foreignKey: 'user_id',
        onDelete: 'CASCADE'
      });
    };
  
    return Url;
  };
  