module.exports = (sequelize, DataTypes) => {
  const Url_Content_Table = sequelize.define('Url_Content_Table', {
    contentId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    url_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Urls', // Refers to the Url table
        key: 'url_id',
      },
    },
    content: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Duration: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return Url_Content_Table;
};
