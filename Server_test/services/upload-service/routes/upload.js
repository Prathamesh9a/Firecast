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
const libre = require('libreoffice-convert');
const { promisify } = require('util');
const libreConvert = promisify(libre.convert);

const secret_key = "TickerApplication";
const { log } = require('console');
// console.log(`The IP address is: ${ipAddress}`);

const encryptedLimit = 'e7ZLZFFrXSiP/1U2FOvj4w=='; // Replace with your actual encrypted value
const secretUrlKey = '9ATicker'; // Use the same key that was used for encryption

let userId
let username
// const baseURL = `http://${ipAddress}:3000`; // Dynamic base URL
const baseURL = `http://122.179.140.84:86`; // Dynamic base URL

function generateRandomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Function to convert PPT/PPTX to PDF
async function convertPptToPdf(inputPath, outputPath) {
  try {
    const fileContent = fs.readFileSync(inputPath);
    const pdfBuffer = await libreConvert(fileContent, '.pdf', undefined);
    fs.writeFileSync(outputPath, pdfBuffer);
    return true;
  } catch (error) {
    console.error('Error converting PPT/PPTX to PDF:', error);
    logger.log('error', `Conversion error: ${error.message}`);
    return false;
  }
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

//With Encrypted Url Limit
router.post('/upload', licenseMiddleware, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        logger.log('error', `File size error: ${err.message}`);
        return res.status(400).json({
          message: `File size exceeds the limit of 500 MB. Please upload a smaller file.`,
        });
      }
      if (err.code === 'LIMIT_UNSUPPORTED_FILE_TYPE') {
        console.error('Invalid file type error:', err.message);
        return res.status(400).json({
          message: err.message,
        });
      }
      logger.log('error', `Error occurred: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }

    console.log('req.body:', req.body);
    console.log('req.files:', req.files);

    let userId = req.body.userId;
    if (Array.isArray(userId)) {
      userId = userId[0];
    }
    const method = req.method;
    const apiName = req.originalUrl;
    const Url_Name = req.body.Url_Name;
    const custom_ticker = req.body.custom_ticker;
    const links = Array.isArray(req.body.links) ? req.body.links : [];

    const token = req.headers.authorization;
    if (!token) {
      logger.log('error', `Error occurred: Missing Token`);
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
          message: 'You have reached the maximum allowed URLs. Please contact Admin or delete an existing URL to create a new one.',
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
          message: `The Url_Name "${Url_Name}" is already taken. Please choose a different name.`,
        });
      }

      const mediaData = [];
      const userUploadDir = `./upload-service/uploads/${username}`;
      const flaskApiUrl = 'http://127.0.0.1:5052/api/summarize';

      // Process files first to handle PPT/PPTX conversions
      const fileConversions = [];

      for (let i = 0; i < links.length; i++) {
        const { link } = links[i];
        const file = req.files.find((f) => f.fieldname === `links[${i}][file]`);

        if (file && (file.mimetype === 'application/vnd.ms-powerpoint' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
          // This is a PPT/PPTX file, convert it to PDF
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf('.')) + '.pdf';

          // Add to array of conversion promises
          fileConversions.push({
            index: i,
            promise: convertPptToPdf(originalPath, pdfPath),
            originalFile: file,
            pdfPath
          });
        }
      }

      // Wait for all conversions to complete
      for (const conversion of fileConversions) {
        const success = await conversion.promise;
        if (success) {
          // Update the file reference in req.files
          const originalFile = conversion.originalFile;
          const pdfFilename = path.basename(conversion.pdfPath);

          // Add new PDF file info to req.files
          req.files.push({
            fieldname: originalFile.fieldname,
            originalname: pdfFilename,
            encoding: originalFile.encoding,
            mimetype: 'application/pdf',
            destination: originalFile.destination,
            filename: pdfFilename,
            path: conversion.pdfPath,
            size: fs.statSync(conversion.pdfPath).size
          });

          console.log(`Converted ${originalFile.filename} to ${pdfFilename}`);
        } else {
          console.error(`Failed to convert file at index ${conversion.index}`);
        }
      }

      // Now proceed with the regular processing
      for (let i = 0; i < links.length; i++) {
        const { link, time, analyzeWithAI, schedule = {}, fileName, layout, custom_ticker } = links[i];
        let contentPath = link;

        const parsedTime = parseInt(time, 10);
        if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
          return res.status(400).json({ message: `Please enter a valid time for item ${i + 1}` });
        }

        if (!link && !req.files.some((f) => f.fieldname === `links[${i}][file]`)) {
          return res.status(400).json({
            message: `No link or file provided for item ${i + 1}.`,
          });
        }

        // Find any files for this link index
        const originalFile = req.files.find((f) => f.fieldname === `links[${i}][file]` &&
          (f.mimetype === 'application/vnd.ms-powerpoint' ||
            f.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'));

        // Check if we have a converted PDF for this PPT/PPTX
        const pdfFile = originalFile ?
          req.files.find(f => f.fieldname === originalFile.fieldname &&
            f.mimetype === 'application/pdf' &&
            f !== originalFile) :
          null;

        // Use PDF file if available, otherwise use whatever file we have
        const file = pdfFile || req.files.find((f) => f.fieldname === `links[${i}][file]`);

        if (link && link.startsWith('blob:') && file) {
          contentPath = `/${username}/${Url_Name}/${file.filename}`;

          // If this is a PDF (either original or converted), analyze with AI if requested
          if (file.mimetype === 'application/pdf' && analyzeWithAI === 'true') {
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
                    fileName: pdfFile ? pdfFile.filename : fileName,
                    layout,
                    custom_ticker,
                    originalFormat: originalFile ? path.extname(originalFile.originalname).substring(1) : null
                  });
                  continue;
                }
              } else {
                console.error(`PDF file does not exist at path: ${pdfPath}`);
              }
            } catch (flaskError) {
              console.error('Failed to summarize PDF:', flaskError);
            }
          }
        } else if (link && !link.startsWith('blob:')) {
          contentPath = link;
        }

        // Validate and format schedule dates
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
        // Ensure weeklyDays is an array
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

        // Add information about original format if this was converted
        const originalFormat = originalFile ? path.extname(originalFile.originalname).substring(1) : null;

        mediaData.push({
          content: contentPath,
          time: parsedTime,
          schedule: validatedSchedule,
          fileName: pdfFile ? pdfFile.filename : fileName,
          layout,
          custom_ticker,
          originalFormat
        });
      }

      const uniqueUrl = `${Url_Name}`;

      const newTickerData = await db.TickerData.create({
        user_id: userId,
        url_content: mediaData,
        url: uniqueUrl,
        Url_Name: Url_Name,
        custom_ticker :custom_ticker,
        
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
      console.error('Error saving data:', error);
      logger.log('error', `Error occurred: ${error.message}`);
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
      return res.status(409).json({ message: 'No URLs found. Start by creating a new one!' });
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
router.patch("/updateUrlContent", async (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        console.error("File size error:", err.message);
        return res.status(400).json({
          message: "File size exceeds the limit of 2GB. Please upload a smaller file.",
        });
      }
    } else if (err) {
      if (err.code === "LIMIT_UNSUPPORTED_FILE_TYPE") {
        console.error("Invalid file type error:", err.message);
        return res.status(400).json({
          message: err.message,
        });
      }
      console.error("Unexpected error:", err.message);
      return res.status(500).json({
        message: "An unexpected error occurred while uploading the file.",
      });
    }

    try {
      const token = req.headers.authorization;
      if (!token) {
        return res
          .status(401)
          .json({ message: "Unauthorized: Token is missing" });
      }

      const decodedToken = jwt.verify(token, secret_key);
      const userId = decodedToken.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized token" });
      }

      const { id, Url_Name, custom_ticker } = req.body; // Added custom_ticker
      const links = req.body.links || [];
      const method = req.method;
      const apiName = req.originalUrl;

      if (!Url_Name || Url_Name.trim() === "") {
        return res.status(400).json({ message: "Url_Name is required" });
      }

      const existingUrl = await db.TickerData.findOne({
        where: {
          Url_Name: Url_Name,
          ...(id ? { id: { [db.Sequelize.Op.ne]: id } } : {}),
        },
      });

      if (existingUrl) {
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is already taken. Please choose a different name.`,
        });
      }

      const mediaData = [];
      const validLayouts = ["single", "2x1", "1x2", "2x2", "3x1", "1x3"];

      if (!id || !Array.isArray(links)) {
        return res
          .status(400)
          .json({ message: "Invalid request. Please provide a valid ID and links array." });
      }

      const tickerData = await db.TickerData.findOne({ where: { id } });
      if (!tickerData) {
        return res.status(404).json({ message: "Record not found" });
      }

      if (req.files && req.files.length > 0) {
        const existingContent = tickerData.url_content || [];
        for (const item of existingContent) {
          const content = item?.content;
          if (content && content.startsWith("/")) {
            const filePath = path.join(
              __dirname,
              `../upload-service/uploads/${username}/${Url_Name}/`,
              content.split("/").pop()
            );
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }

        for (let i = 0; i < links.length; i++) {
          const { link, time, layout, schedule = {} } = links[i];
          let contentPath = link;

          const parsedTime = parseInt(time, 10);
          if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
            return res
              .status(400)
              .json({ message: `Please enter a valid time for item ${i + 1}` });
          }

          if (!link || link.trim() === "") {
            return res
              .status(400)
              .json({ message: `Please enter valid content for item ${i + 1}` });
          }

          if (layout && !validLayouts.includes(layout)) {
            return res.status(400).json({
              message: `Invalid layout value for item ${i + 1}. Allowed values are: ${validLayouts.join(", ")}`,
            });
          }

          if (link.startsWith("blob:")) {
            const uploadedFile = req.files.find(
              (f) => f.fieldname === `links[${i}][file]`
            );
            if (uploadedFile) {
              contentPath = `/${username}/${Url_Name}/${uploadedFile.filename}`;
            }
          }

          // Validate and format schedule
          const validatedSchedule = { ...schedule };
          if (validatedSchedule.startDate) {
            validatedSchedule.startDate = new Date(
              validatedSchedule.startDate
            ).toISOString();
          }
          if (validatedSchedule.endDate) {
            validatedSchedule.endDate = new Date(
              validatedSchedule.endDate
            ).toISOString();
          }
          if (validatedSchedule.repeatUntil) {
            validatedSchedule.repeatUntil = new Date(
              validatedSchedule.repeatUntil
            ).toISOString();
          }
          if (typeof validatedSchedule.weeklyDays === "string") {
            try {
              validatedSchedule.weeklyDays = JSON.parse(
                validatedSchedule.weeklyDays
              );
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
            layout: layout || "single",
            schedule: validatedSchedule,
          });
        }
      } else {
        for (let i = 0; i < links.length; i++) {
          const { link, time, layout, schedule = {} } = links[i];
          const parsedTime = parseInt(time, 10);
          if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
            return res
              .status(400)
              .json({ message: `Please enter a valid time for item ${i + 1}` });
          }

          if (!link || link.trim() === "") {
            return res
              .status(400)
              .json({ message: `Please enter valid content for item ${i + 1}` });
          }

          if (layout && !validLayouts.includes(layout)) {
            return res.status(400).json({
              message: `Invalid layout value for item ${i + 1}. Allowed values are: ${validLayouts.join(", ")}`,
            });
          }

          // Validate and format schedule
          const validatedSchedule = { ...schedule };
          if (validatedSchedule.startDate) {
            validatedSchedule.startDate = new Date(
              validatedSchedule.startDate
            ).toISOString();
          }
          if (validatedSchedule.endDate) {
            validatedSchedule.endDate = new Date(
              validatedSchedule.endDate
            ).toISOString();
          }
          if (validatedSchedule.repeatUntil) {
            validatedSchedule.repeatUntil = new Date(
              validatedSchedule.repeatUntil
            ).toISOString();
          }
          if (typeof validatedSchedule.weeklyDays === "string") {
            try {
              validatedSchedule.weeklyDays = JSON.parse(
                validatedSchedule.weeklyDays
              );
            } catch (e) {
              validatedSchedule.weeklyDays = [];
            }
          }
          if (!Array.isArray(validatedSchedule.weeklyDays)) {
            validatedSchedule.weeklyDays = [];
          }

          mediaData.push({
            content: link,
            time: parsedTime,
            layout: layout || "single",
            schedule: validatedSchedule,
          });
        }
      }

      // Update tickerData with custom_ticker
      await tickerData.update({
        url_content: mediaData,
        Url_Name: req.body.Url_Name,
        url: req.body.Url_Name,
        custom_ticker: custom_ticker || "", // Store custom_ticker
      });

      const previewUrl = `${baseURL}/${tickerData.url}`;

      logger.logUserActivity(method, apiName, {
        user_id: userId,
        previewUrl: previewUrl,
        message: `URLs Updated successfully By User ${userId}`,
        Updated_id: `${tickerData.id}`,
      });

      res.json({
        message: "URL content updated successfully",
        data: {
          id: tickerData.id,
          user_id: tickerData.user_id,
          url_content: tickerData.url_content,
          custom_ticker: tickerData.custom_ticker, // Include in response
          previewUrl,
        },
      });
    } catch (error) {
      console.error("Error updating URL content:", error.message);
      logger.log("error", `Error occurred: ${error.message}`);
      res.status(500).json({
        message: "Failed to update URL content",
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
