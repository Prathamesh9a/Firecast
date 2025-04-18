// const express = require('express');
// const cors = require('cors');
// const path = require('path');
// const uploadRoutes = require('./routes/upload'); // Import the upload routes

// const app = express();
// const port = process.env.PORT || 5001; // Ensure this port is different from other services

// // Enable CORS for cross-origin requests
// app.use(cors({
//   origin: 'http://localhost:3000', 
// }));

// // Serve uploaded files from the "uploads" directory
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Use the upload routes from the routes/upload.js file
// app.use('/api', uploadRoutes);

// // Start the server
// app.listen(port, () => {
//   console.log(`Upload service running on port ${port}`);
// });







const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const uploadRoutes = require('./routes/upload');
const logger = require('../../Utility/logger'); // Import logger

const app = express();

app.use(cors());
app.use(express.json());


app.use(bodyParser.urlencoded({ extended: true }));

// Use upload routes here
app.use('toggleUrlStatus', uploadRoutes);

process.on('uncaughtException', (error) => {
    logger.log('error', `Uncaught Exception: ${error.message}`);
    process.exit(1); // Exit the process to avoid unpredictable behavior
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.log('error', `Unhandled Rejection: ${reason.message || reason}`);
    process.exit(1); // Exit the process to avoid unpredictable behavior
});
module.exports = app; // Export the app
