// const express = require('express');
// const cors = require('cors'); 
// const authRoutes = require('./routes/auth');
// const app = express();


// app.use(cors({
//   origin: 'http://localhost:3000', 
// }));

// app.use(express.json());


// app.use('/api/auth', authRoutes);


// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Auth service running on port ${PORT}`));


const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const logger = require('../../Utility/logger'); // Import logger

const app = express();

app.use(cors());
app.use(express.json());

// Use auth routes here
app.use('/api/auth', authRoutes);

process.on('uncaughtException', (error) => {
    logger.log('error', `Uncaught Exception: ${error.message}`);
    process.exit(1); // Exit the process to avoid unpredictable behavior
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.log('error', `Unhandled Rejection: ${reason.message || reason}`);
    process.exit(1); // Exit the process to avoid unpredictable behavior
});
module.exports = app; // Export the app
