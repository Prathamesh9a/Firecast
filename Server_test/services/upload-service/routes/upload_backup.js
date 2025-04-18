const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../../models');
const jwt = require('jsonwebtoken');
const xml2js = require('xml2js');
const router = express.Router();
const axios = require('axios');
// const { authenticate, decrypt } = require('../middlewares/middlewares');
const licenseMiddleware = require('../middlewares/licenseMiddleware');
const logger = require('../../../Utility/logger'); // Import logger
const { ipAddress } = require('../../../config/ipAddress');

const secret_key = "TickerApplication";
const { log } = require('console');
// console.log(`The IP address is: ${ipAddress}`);

const encryptedLimit = 'e7ZLZFFrXSiP/1U2FOvj4w=='; // Replace with your actual encrypted value
const secretUrlKey = '9ATicker'; // Use the same key that was used for encryption

let userId
let username
const baseURL = `http://${ipAddress}:3001`; // Dynamic base URL
// const baseURL = `http://122.179.140.84:86`; // Dynamic base URL

function generateRandomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Extract the userId from the request body
      const user_id = req.body.userId;
      const url_Name = req.body.Url_Name;
      const user = await db.User.findOne({
        where: { id: user_id },
        attributes: ['username'],
      });

      if (!user) {
        return cb(new Error('User not found'));
      }

      username = user.username;

      const userUploadDir = `./upload-service/uploads/${username}`;

      const userFile = `./upload-service/uploads/${username}/${url_Name}`;

      // Ensure the user's upload directory exists
      if (!fs.existsSync(userUploadDir)) {
        fs.mkdirSync(userUploadDir, { recursive: true });
      }
      if (!fs.existsSync(userFile)) {
        fs.mkdirSync(userFile, { recursive: true });
      }

      cb(null, userFile); // Proceed with multer to store files in the user's folder
    } catch (err) {
      console.error('Error setting up multer storage:', err);
      logger.log('error', `Error occurred: ${err.message}`);
      cb(err); // Pass the error to multer's callback
    }
  },

  // filename: (req, file, cb) => {
  //   cb(null, username + '-' + file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Create unique filename
  // },
  filename: (req, file, cb) => {
    // Preserve original filename but make it unique
    const originalName = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${originalName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 524288000 }, // 500 MB in bytes
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml',  // Correct MIME type for SVG
      'video/mp4',
      'video/webm',
      'video/quicktime', // MOV

      // Documents
      "application/pdf",
      "application/vnd.ms-powerpoint", // PPT
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
      "application/msword", // DOC
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      // Pass an error with a meaningful message
      const error = new Error(`Unsupported file type: ${file.mimetype}`);
      error.code = 'LIMIT_UNSUPPORTED_FILE_TYPE'; // Custom error code for consistency
      return cb(error, false); // Pass the error to the Multer callback
    }
    cb(null, true);
  },
}).any();

// Helper function to convert DOC, DOCX, PPT, PPTX files to PDF using LibreOffice
async function convertToPdf(filePath, ext) {
  return new Promise((resolve, reject) => {
    const outputDir = './pdfs'; // Directory for PDF output
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const pdfOutputPath = path.join(outputDir, path.basename(filePath, ext) + '.pdf');
    const command = `libreoffice --headless --convert-to pdf "${filePath}" --outdir "${outputDir}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during conversion: ${stderr}`);
        reject(`Failed to convert ${filePath} to PDF`);
      } else {
        resolve(pdfOutputPath);
      }
    });
  });
}

// Helper function to parse links with schedule data from form-data
function parseLinksFromBody(body, files) {
  const links = [];
  let index = 0;

  while (body[`links[${index}][link]`] !== undefined) {
    const link = body[`links[${index}][link]`];
    const time = parseInt(body[`links[${index}][time]`], 10);
    const analyzeWithAI = body[`links[${index}][analyzeWithAI]`] === 'true';
    const fileName = body[`links[${index}][fileName]`] || '';
    const layout = body[`links[${index}][layout]`] || 'single';

    const schedule = {
      startTime: body[`links[${index}][schedule][startTime]`] || '',
      endTime: body[`links[${index}][schedule][endTime]`] || '',
      startDate: body[`links[${index}][schedule][startDate]`] || '',
      endDate: body[`links[${index}][schedule][endDate]`] || '',
      frequency: body[`links[${index}][schedule][frequency]`] || 'none',
      repeatInterval: parseInt(body[`links[${index}][schedule][repeatInterval]`] || 1, 10),
      repeatUntil: body[`links[${index}][schedule][repeatUntil]`] || '',
      weeklyDays: body[`links[${index}][schedule][weeklyDays]`]
        ? JSON.parse(body[`links[${index}][schedule][weeklyDays]`])
        : [],
      monthlyRule: body[`links[${index}][schedule][monthlyRule]`] || '',
      displayMode: body[`links[${index}][schedule][displayMode]`] || 'exclusive',
      priority: body[`links[${index}][schedule][priority]`] || 'medium',
    };

    const file = files.find((f) => f.fieldname === `links[${index}][file]`);

    links.push({ link, time, analyzeWithAI, schedule, file, fileName, layout });
    index++;
  }

  return links;
}

router.post('/upload', licenseMiddleware, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        logger.log('error', `File size error: ${err.message}`);
        return res.status(400).json({
          message: `File size exceeds the limit of 500 MB.`,
        });
      }
      if (err.code === 'LIMIT_UNSUPPORTED_FILE_TYPE') {
        logger.log('error', `Invalid file type: ${err.message}`);
        return res.status(400).json({ message: err.message });
      }
      logger.log('error', `Upload error: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }

    let userId = req.body.userId;
    if (Array.isArray(userId)) {
      userId = userId[0];
    }
    const method = req.method;
    const apiName = req.originalUrl;
    const Url_Name = req.body.Url_Name;
    const links = parseLinksFromBody(req.body, req.files);

    const token = req.headers.authorization;
    if (!token) {
      logger.log('error', `Missing Token`);
      return res.status(401).json({ message: 'Unauthorized: Token is missing' });
    }

    try {
      jwt.verify(token, secret_key);

      if (links.length === 0) {
        return res.status(400).json({
          message: 'No content provided. Please add at least one link or file.',
        });
      }

      const MAX_URL_LIMIT = 6;
      const userUrlCount = await db.TickerData.count({
        where: { user_id: userId },
      });

      if (userUrlCount >= MAX_URL_LIMIT) {
        return res.status(403).json({
          message: 'You have reached the maximum allowed URLs.',
        });
      }

      if (!Url_Name || Url_Name.trim() === '') {
        return res.status(400).json({ message: 'Url_Name is required' });
      }

      const existingUrl = await db.TickerData.findOne({
        where: { Url_Name: Url_Name },
      });

      if (existingUrl) {
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is already taken.`,
        });
      }

      const mediaData = [];
      const user = await db.User.findOne({
        where: { id: userId },
        attributes: ['username'],
      });
      const username = user.username;
      const userUploadDir = `./upload-service/uploads/${username}`;
      const flaskApiUrl = 'http://127.0.0.1:5052/api/summarize';

      for (let i = 0; i < links.length; i++) {
        const { link, time, analyzeWithAI, schedule, file, fileName, layout } = links[i];
        let contentPath = link;

        const parsedTime = parseInt(time, 10);
        if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
          return res.status(400).json({ message: `Invalid time for item ${i + 1}` });
        }

        if (!link && !file) {
          return res.status(400).json({
            message: `No link or file provided for item ${i + 1}.`,
          });
        }

        if (link && link.startsWith('blob:') && file) {
          contentPath = `/${username}/${Url_Name}/${file.filename}`;
          if (file.mimetype === 'application/pdf' && analyzeWithAI) {
            try {
              const pdfPath = path.join(userUploadDir, Url_Name, file.filename);
              if (fs.existsSync(pdfPath)) {
                const pdfBuffer = fs.readFileSync(pdfPath);
                const base64Pdf = pdfBuffer.toString('base64');
                const response = await axios.post(
                  flaskApiUrl,
                  { pdf: base64Pdf, filename: file.filename },
                  { headers: { 'Content-Type': 'application/json' } }
                );
                if (response.data && response.data.summary) {
                  mediaData.push({
                    content: contentPath,
                    time: parsedTime,
                    summary: response.data.summary,
                    schedule,
                    fileName,
                    layout,
                  });
                  continue;
                }
              }
            } catch (flaskError) {
              logger.log('error', `Failed to summarize PDF: ${flaskError.message}`);
            }
          }
        } else if (link && !link.startsWith('blob:')) {
          contentPath = link;
        }

        const validatedSchedule = { ...schedule };
        if (validatedSchedule.startDate) {
          validatedSchedule.startDate = new Date(validatedSchedule.startDate).toISOString();
        }
        if (validatedSchedule.endDate) {
          validatedSchedule.endDate = new Date(validatedSchedule.endDate).toISOString();
        }
        if (validatedSchedule.repeatUntil) {
          validatedSchedule.repeatUntil = new Date(validatedSchedule.repeatUntil).toISOString();
        }
        if (typeof validatedSchedule.weeklyDays === 'string') {
          try {
            validatedSchedule.weeklyDays = JSON.parse(validatedSchedule.weeklyDays);
          } catch (e) {
            validatedSchedule.weeklyDays = [];
          }
        }
        if (!Array.isArray(validatedSchedule.weeklyDays)) {
          validatedSchedule.weeklyDays = [];
        }

        mediaData.push({
          content: contentPath,
          time: parsedTime,
          schedule: validatedSchedule,
          fileName,
          layout,
        });
      }

      const uniqueUrl = `${Url_Name}`;

      const newTickerData = await db.TickerData.create({
        user_id: userId,
        url_content: mediaData,
        url: uniqueUrl,
        Url_Name: Url_Name,
        layout: mediaData[0]?.layout || 'single', // Store the first item's layout or default
      });

      logger.logUserActivity(method, apiName, {
        user_id: userId,
        previewUrl: `${baseURL}/${uniqueUrl}`,
        message: `URLs and files created successfully by User ${userId}`,
      });

      res.json({
        message: 'URLs and files created successfully',
        previewUrl: `${baseURL}/${uniqueUrl}`,
      });
    } catch (error) {
      logger.log('error', `Error saving data: ${error.message}`);
      res.status(500).json({ message: 'Failed to save data' });
    }
  });
});

router.post('/existingUrl', async (req, res) => {
  const { userId } = req.body;

  const token = req.headers.authorization // Extract Bearer token
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token is missing' });
  }

  try {
    const verifytoken = jwt.verify(token, secret_key);

    // const baseURL = `http://192.168.1.27:3000`; // Dynamic base URL
    // Fetch TickerData associated with the authenticated user
    const tickerData = await db.TickerData.findAll({
      where: { user_id: userId },
    });

    if (!tickerData || tickerData.length === 0) {
      return res.status(409).json({ message: 'You Dont Have Any URL To Display' });
    }

    const dataWithPreviewUrls = tickerData.map(item => ({
      ...item.toJSON(),
      previewUrl: `${baseURL}/${item.url}`,
    }));

    res.json(dataWithPreviewUrls);
  } catch (error) {
    console.error('Error fetching existing URLs or verifying token:', error.message);
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(401).json({ message: 'Unauthorized: Invalid token', error: error.message });
  }
});

//routes/upload.js
router.put('/updateUrlContent', async (req, res) => {
  upload(req, res, async (err) => {
    // Multer errors (File type, size, etc.)
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        console.error('File size error:', err.message);
        return res.status(400).json({
          message: 'File size exceeds the limit of 2GB. Please upload a smaller file.',
        });
      }
    } else if (err) {
      // Handle unsupported file type error
      if (err.code === 'LIMIT_UNSUPPORTED_FILE_TYPE') {
        // Handle unsupported file type error
        console.error('Invalid file type error:', err.message);
        return res.status(400).json({
          message: err.message, // The error message will include the invalid MIME type
        });
      }
      // Handle unexpected errors
      console.error('Unexpected error:', err.message);
      return res.status(500).json({
        message: 'An unexpected error occurred while uploading the file.',
      });
    }


    try {

      // Ensure token is provided and valid
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Token is missing' });
      }
      // Verify token and extract payload
      const decodedToken = jwt.verify(token, secret_key); // Ensure secret_key is defined
      const userId = decodedToken.userId; // Extract `userId` from the payload

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized token' });
      }

      // Extract id and url_content from req.body
      const { id, Url_Name } = req.body;

      const method = req.method;
      const apiName = req.originalUrl;
      const links = req.body.links || [];

      // Ensure Url_Name is provided
      if (!Url_Name || Url_Name.trim() === '') {
        return res.status(400).json({ message: 'Url_Name is required' });
      }

      // Check if Url_Name already exists in the database, excluding the current record
      const existingUrl = await db.TickerData.findOne({
        where: {
          Url_Name: Url_Name,
          ...(id ? { id: { [db.Sequelize.Op.ne]: id } } : {}), // Exclude current record if updating
        },
      });

      if (existingUrl) {
        // If Url_Name is already taken, return a response asking the user to select a different name
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is already taken. Please choose a different name.`,
        });
      }
      const mediaData = [];

      // Check if both id and url_content are valid
      if (!id || !Array.isArray(links)) {
        return res.status(400).json({ message: 'Invalid request. Please provide a valid ID and url_content array.' });
      }

      // Find the record to update
      const tickerData = await db.TickerData.findOne({ where: { id } });
      if (!tickerData) {
        return res.status(404).json({ message: 'Record not found' });
      }


      // If new files are uploaded, handle them
      if (req.files && req.files.length > 0) {
        const existingContent = tickerData.links || [];
        for (const item of existingContent) {
          const content = item?.content;
          if (content && content.startsWith('/')) {
            const filePath = path.join(__dirname, `../upload-service/uploads/${username}//${Url_Name}/`, content);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath); // Delete the old file
            }
          }
        }

        // Process links and files
        if (Array.isArray(links)) {
          for (let i = 0; i < links.length; i++) {
            const { link, time, content } = links[i];

            let contentPath = link;

            // Validation: Check if time is not a positive number
            if (!time || isNaN(time) || time <= 0) {
              return res.status(409).json({ message: `Please Enter Valid Time` });
            }

            // Validation: Check if link is empty or null
            if (!link || link.trim() === "") {
              return res.status(409).json({ message: `Please Enter Valid Content` });
            }

            // Validation: Check if content is empty or null
            // if (!content || content.trim() === "") {
            //   return res.status(409).json({ message: `Please Enter Valid Content content ` });
            // }

            // Check if it's a blob URL and handle file uploads
            if (link.startsWith('blob:')) {
              const uploadedFile = req.files.find(f => f.fieldname === `links[${i}][file]`);
              if (uploadedFile) {
                contentPath = `/${username}/${Url_Name}/${uploadedFile.filename}`;
              }
            }

            mediaData.push({
              content: contentPath,
              time,
            });
          }
        }
      } else {
        // If no files are uploaded, just handle the links as is
        if (Array.isArray(links)) {
          for (let i = 0; i < links.length; i++) {
            const { link, time } = links[i];
            if (!time || isNaN(time) || time <= 0) {
              return res.status(409).json({ message: `Please Enter Valid Time` });
            }

            // Validation: Check if link is empty or null
            if (!link || link.trim() === "") {
              return res.status(409).json({ message: `Please Enter Valid Content` });
            }
            mediaData.push({
              content: link,
              time,
            });
          }
        }
      }

      // Update the record with new content
      await tickerData.update({ url_content: mediaData });

      // Update the Url_Name if provided in request
      if (req.body.Url_Name) {
        // First check if the new name is already taken by another record
        const existingUrl = await db.TickerData.findOne({
          where: {
            Url_Name: req.body.Url_Name,
            id: { [db.Sequelize.Op.ne]: id } // Exclude current record
          }
        });

        if (existingUrl) {
          return res.status(400).json({
            message: `The Screen "${req.body.Url_Name}" is already taken. Please choose a different name.`
          });
        }

        // If name is available, update it
        await tickerData.update({ Url_Name: req.body.Url_Name });

        // You might also want to update the url field if it's based on Url_Name
        await tickerData.update({ url: req.body.Url_Name });
      }
      // Generate preview URL
      // const baseURL = `http://192.168.1.27:3000`;
      const previewUrl = `${baseURL}/${tickerData.url}`;

      logger.logUserActivity(method, apiName, { user_id: userId, previewUrl: previewUrl, message: `URLs Updated successfully By User ${userId}`, Updated_id: `${tickerData.id}`, });

      res.json({
        message: 'URL content updated successfully',
        data: {
          id: tickerData.id,
          user_id: tickerData.user_id,
          url_content: tickerData.url_content,
          previewUrl,
        },
      });
    } catch (error) {
      console.error('Error updating URL content:', error.message);
      logger.log('error', `Error occurred: ${error.message}`);
      res.status(500).json({
        message: 'Failed to update URL content',
        error: error.message,
      });
    }
  });
});

// router.delete('/deleteUrl', async (req, res) => {
//   const token = req.headers.authorization;
//   if (!token) {
//     return res.status(401).json({ message: 'Unauthorized: Token is missing' });
//   }


//   try {
//     const decodedToken = jwt.verify(token, secret_key);
//     const userId = decodedToken.userId;
//     if (!userId) {
//       return res.status(401).json({ message: 'Unauthorized token' });
//     }

//     const { id } = req.body;
//     const method = req.method;
//     const apiName = req.originalUrl;

//     if (!id) {
//       return res.status(400).json({ message: 'Invalid request. Please provide a valid ID.' });
//     }

//     // Find the record to delete
//     const tickerData = await db.TickerData.findOne({ where: { id } });
//     if (!tickerData) {
//       return res.status(404).json({ message: 'Record not found' });
//     }

//     // Get username for file path construction
//     const user = await db.User.findOne({ where: { id: userId }, attributes: ['username'] });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Delete associated files
//     if (tickerData.url_content && Array.isArray(tickerData.url_content)) {
//       for (const item of tickerData.url_content) {
//         if (item.content && item.content.startsWith('/')) {
//           const filePath = path.join(
//             __dirname,
//             '../upload-service/uploads',
//             user.username,
//             tickerData.Url_Name,
//             path.basename(item.content)
//           );

//           try {
//             if (fs.existsSync(filePath)) {
//               fs.unlinkSync(filePath);
//             }
//           } catch (err) {
//             console.error(`Error deleting file: ${filePath}`, err.message);
//           }
//         }
//       }

//       // Delete the entire folder if empty
//       const folderPath = path.join(
//         __dirname,
//         '../upload-service/uploads',
//         user.username,
//         tickerData.Url_Name
//       );

//       try {
//         if (fs.existsSync(folderPath)) {
//           const files = fs.readdirSync(folderPath);
//           if (files.length === 0) {
//             fs.rmdirSync(folderPath);
//           }
//         }
//       } catch (err) {
//         console.error(`Error deleting folder: ${folderPath}`, err.message);
//       }
//     }

//     // Delete the record from the database
//     await tickerData.destroy();

//     logger.logUserActivity(method, apiName, {
//       user_id: userId,
//       tickerData,
//       message: `URLs deleted successfully By User ${userId}`,
//       deleted_Id: id
//     });

//     res.json({ message: 'URL and associated files deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting URL data:', error.message);
//     logger.log('error', `Error occurred: ${error.message}`);
//     res.status(500).json({
//       message: 'Failed to delete URL data',
//       error: error.message,
//     });
//   }
// });

router.delete('/deleteUrl', async (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token is missing' });
  }

  try {
    const decodedToken = jwt.verify(token, secret_key);
    const userId = decodedToken.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized token' });
    }

    const { id } = req.body;
    const method = req.method;
    const apiName = req.originalUrl;

    if (!id) {
      return res.status(400).json({ message: 'Invalid request. Please provide a valid ID.' });
    }

    // Find the record to delete
    const tickerData = await db.TickerData.findOne({ where: { id } });
    if (!tickerData) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Get username for file path construction
    const user = await db.User.findOne({ where: { id: userId }, attributes: ['username'] });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const username = user.username;
    const urlName = tickerData.Url_Name;

    // Delete associated files
    if (tickerData.url_content && Array.isArray(tickerData.url_content)) {
      logger.log('info', `Deleting ${tickerData.url_content.length} files for URL ID: ${id}`);

      for (const item of tickerData.url_content) {
        // Check if the content is a file path (starts with /)
        if (item.content && typeof item.content === 'string' && item.content.startsWith('/')) {
          try {
            // Construct absolute file path
            // Note: adjusting the path based on your directory structure
            const relativePath = item.content.substring(1); // Remove leading slash
            const filePath = path.join(process.cwd(), 'upload-service/uploads', relativePath);

            logger.log('info', `Attempting to delete file: ${filePath}`);

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.log('info', `Successfully deleted file: ${filePath}`);
            } else {
              logger.log('warn', `File not found for deletion: ${filePath}`);
            }
          } catch (err) {
            logger.log('error', `Error deleting file: ${err.message}`);
            console.error(`Error deleting file:`, err);
            // Continue with other files even if one fails
          }
        }
      }
    }

    // Delete the folder for this URL if it exists and is empty
    try {
      const folderPath = path.join(process.cwd(), 'upload-service/uploads', username, urlName);
      logger.log('info', `Checking if folder exists: ${folderPath}`);

      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        logger.log('info', `Folder contains ${files.length} files`);

        if (files.length === 0) {
          fs.rmdirSync(folderPath);
          logger.log('info', `Empty folder deleted: ${folderPath}`);
        } else {
          // Force delete all remaining files and then the folder
          logger.log('info', `Forcing deletion of remaining ${files.length} files`);

          for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.log('info', `Forced deletion of file: ${filePath}`);
            }
          }

          // Try to delete the folder again after clearing files
          if (fs.existsSync(folderPath)) {
            fs.rmdirSync(folderPath);
            logger.log('info', `Folder deleted after clearing: ${folderPath}`);
          }
        }
      } else {
        logger.log('info', `Folder does not exist: ${folderPath}`);
      }
    } catch (err) {
      logger.log('error', `Error handling URL folder: ${err.message}`);
      console.error(`Error handling URL folder:`, err);
      // Continue with URL deletion even if folder operations fail
    }

    // Delete the record from the database
    await tickerData.destroy();

    logger.logUserActivity(method, apiName, {
      user_id: userId,
      urlName: tickerData.Url_Name,
      message: `URL and all associated files deleted successfully by User ${userId}`,
      deleted_Id: id
    });

    res.json({ message: 'URL and all associated files deleted successfully' });
  } catch (error) {
    console.error('Error deleting URL data:', error.message);
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({
      message: 'Failed to delete URL data',
      error: error.message,
    });
  }
});

router.post('/preview/:url', async (req, res) => {
  const { url } = req.params;

  try {
    const tickerData = await db.TickerData.findOne({ where: { url } });

    if (!tickerData) {
      return res.status(404).json({ message: 'URL not found' });
    }

    res.json(tickerData);
  } catch (error) {
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({ message: 'Error fetching preview content' });
  }
});

router.put('/toggleUrlStatus', async (req, res) => {
  try {
    const { id, status, scheduledAt, expiresAt } = req.body;

    const updateData = {
      isEnabled: status,
      scheduledAt: scheduledAt || null,
      expiresAt: expiresAt || null
    };

    const [updated] = await db.TickerData.update(
      updateData,
      { where: { id } }
    );

    if (updated) {
      const updatedUrl = await db.TickerData.findByPk(id);
      res.status(200).json(updatedUrl);
    } else {
      res.status(404).json({ message: 'URL not found' });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error updating status',
      error: error.message
    });
  }
});

router.get('/parse-rss', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Attempt to fetch the RSS feed using fetch API
    let response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10000), // 10 seconds timeout
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `RSS feed returned ${response.status} status`,
          details: `The requested RSS feed at ${url} returned a ${response.status} status code. Please verify the URL is correct.`,
        });
      }
    } catch (fetchError) {
      console.error('Error fetching RSS feed:', fetchError.message);
      return res.status(502).json({
        error: 'Failed to fetch RSS feed',
        details: fetchError.message,
      });
    }

    // Ensure we actually got XML content
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('rss')) {
      return res.status(415).json({
        error: 'Invalid content type',
        details: `Expected XML content but received: ${contentType}`,
      });
    }

    // Parse the RSS content
    const text = await response.text();
    const parser = new xml2js.Parser();
    parser.parseString(text, (err, result) => {
      if (err) {
        return res.status(422).json({
          error: 'Failed to parse RSS',
          details: err.message,
        });
      }

      // Verify we have a valid RSS structure
      if (!result || !result.rss || !result.rss.channel || !result.rss.channel[0].item) {
        return res.status(422).json({
          error: 'Invalid RSS format',
          details: 'The fetched content does not have a valid RSS structure',
        });
      }

      const items = result.rss.channel[0].item.map((item) => ({
        title: item.title ? item.title[0] : 'No title',
        description: item.description ? item.description[0] : 'No description',
        source: result.rss.channel[0].title ? result.rss.channel[0].title[0] : 'Unknown source',
        url: item.link ? item.link[0] : '',
        publishedAt: item.pubDate ? item.pubDate[0] : new Date().toISOString(),
      }));

      res.json({ items });
    });
  } catch (error) {
    console.error('RSS parsing error:', error);
    res.status(500).json({
      error: 'Failed to process RSS feed',
      details: error.message,
    });
  }
});

module.exports = router;
