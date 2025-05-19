const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../../models');
const jwt = require('jsonwebtoken');
const xml2js = require('xml2js');
const router = express.Router();
const axios = require('axios');
const licenseMiddleware = require('../middlewares/licenseMiddleware');
const logger = require('../../../Utility/logger');
const { ipAddress } = require('../../../config/ipAddress');
const libre = require('libreoffice-convert');
const { promisify } = require('util');
const libreConvert = promisify(libre.convert);
const PDFDocument = require('pdfkit');

const secret_key = "TickerApplication";
const encryptedLimit = 'e7ZLZFFrXSiP/1U2FOvj4w==';
const secretUrlKey = '9ATicker';
const baseURL = `http://122.179.140.84:86`;
//const baseURL = `http://192.168.1.27:3000`;

let userId;
let username;

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
    logger.log('info', `Successfully converted ${inputPath} to PDF`);
    return true;
  } catch (error) {
    console.error('Error converting PPT/PPTX to PDF:', error);
    logger.log('error', `Conversion error: ${error.message}`);
    return false;
  }
}

// Function to convert DOC/DOCX to PDF
async function convertDocToPdf(inputPath, outputPath) {
  try {
    const fileContent = fs.readFileSync(inputPath);
    const pdfBuffer = await libreConvert(fileContent, '.pdf', undefined);
    fs.writeFileSync(outputPath, pdfBuffer);
    logger.log('info', `Successfully converted ${inputPath} to PDF`);
    return true;
  } catch (error) {
    console.error('Error converting DOC/DOCX to PDF:', error);
    logger.log('error', `Conversion error: ${error.message}`);
    return false;
  }
}

// Function to convert TXT to PDF
async function convertTxtToPdf(inputPath, outputPath) {
  try {
    const textContent = fs.readFileSync(inputPath, 'utf8');
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(outputPath);

    // Pipe the PDF document to the output file
    doc.pipe(writeStream);

    // Add text content to the PDF
    doc.fontSize(12).text(textContent, {
      align: 'left',
      wordSpacing: 1,
      lineGap: 2,
    });

    // Finalize the PDF
    doc.end();

    // Wait for the write stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    logger.log('info', `Successfully converted ${inputPath} to PDF`);
    return true;
  } catch (error) {
    console.error('Error converting TXT to PDF:', error);
    logger.log('error', `Conversion error for ${inputPath}: ${error.message}`);
    return false;
  }
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
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

      if (!fs.existsSync(userUploadDir)) {
        fs.mkdirSync(userUploadDir, { recursive: true });
      }
      if (!fs.existsSync(userFile)) {
        fs.mkdirSync(userFile, { recursive: true });
      }

      cb(null, userFile);
    } catch (err) {
      console.error('Error setting up multer storage:', err);
      logger.log('error', `Error occurred: ${err.message}`);
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    const originalName = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${originalName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 524288000 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml',
      'video/mp4',
      // 'video/webm',
      // 'video/mov',
      // 'video/quicktime',
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error(`Unsupported file type: ${file.mimetype}`);
      error.code = 'LIMIT_UNSUPPORTED_FILE_TYPE';
      return cb(error, false);
    }
    cb(null, true);
  },
}).any();

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
    // const settings = req.body.settings || defaultSettings; // Use defaultSettings if not provided

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

      // Process files for PPT/PPTX, DOC/DOCX, and TXT conversions
      const fileConversions = [];

      for (let i = 0; i < links.length; i++) {
        const { link } = links[i];
        const file = req.files.find((f) => f.fieldname === `links[${i}][file]`);

        if (file && (
          file.mimetype === 'application/vnd.ms-powerpoint' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.mimetype === 'application/msword' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.mimetype === 'text/plain'
        )) {
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf('.')) + '.pdf';

          let conversionPromise;
          if (file.mimetype === 'application/vnd.ms-powerpoint' ||
              file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            conversionPromise = convertPptToPdf(originalPath, pdfPath);
          } else if (file.mimetype === 'application/msword' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            conversionPromise = convertDocToPdf(originalPath, pdfPath);
          } else if (file.mimetype === 'text/plain') {
            conversionPromise = convertTxtToPdf(originalPath, pdfPath);
          }

          fileConversions.push({
            index: i,
            promise: conversionPromise,
            originalFile: file,
            pdfPath
          });
        }
      }

      // Wait for all conversions to complete
      for (const conversion of fileConversions) {
        const success = await conversion.promise;
        if (success) {
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

          // Delete original file
          try {
            fs.unlinkSync(originalFile.path);
            logger.log('info', `Deleted original file: ${originalFile.path}`);
          } catch (unlinkError) {
            logger.log('error', `Failed to delete original file ${originalFile.path}: ${unlinkError.message}`);
          }

          console.log(`Converted ${originalFile.filename} to ${pdfFilename}`);
        } else {
          console.error(`Failed to convert file at index ${conversion.index}`);
          return res.status(500).json({
            message: `Failed to convert ${conversion.originalFile.originalname} to PDF`,
          });
        }
      }

      // Process links and files
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

        const originalFile = req.files.find((f) => f.fieldname === `links[${i}][file]` && (
          f.mimetype === 'application/vnd.ms-powerpoint' ||
          f.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          f.mimetype === 'application/msword' ||
          f.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          f.mimetype === 'text/plain'
        ));

        const pdfFile = originalFile ?
          req.files.find(f => f.fieldname === originalFile.fieldname &&
            f.mimetype === 'application/pdf' &&
            f !== originalFile) :
          null;

        const file = pdfFile || req.files.find((f) => f.fieldname === `links[${i}][file]`);

        if (link && link.startsWith('blob:') && file) {
          contentPath = `/${username}/${Url_Name}/${file.filename}`;

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
        custom_ticker: custom_ticker,
        // settings: settings, // Save settings
      });

      logger.logUserActivity(method, apiName, {
        user_id: userId,
        previewUrl: `${baseURL}/${uniqueUrl}`,
        message: `URLs and files created successfully by User ${userId}`,
      });

      res.json({
        message: 'URLs and files created successfully',
        previewUrl: `${baseURL}/${uniqueUrl}`,
        // settings: newTickerData.settings, // Return the saved settings
      });
    } catch (error) {
      console.error('Error saving data:', error);
      logger.log('error', `Error occurred: ${error.message}`);
      res.status(500).json({ message: 'Failed to save data' });
    }
  });
});

router.patch('/updateUrlContent', async (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        console.error('File size error:', err.message);
        return res.status(400).json({
          message: 'File size exceeds the limit of 500MB. Please upload a smaller file.',
        });
      }
    } else if (err) {
      if (err.code === 'LIMIT_UNSUPPORTED_FILE_TYPE') {
        console.error('Invalid file type error:', err.message);
        return res.status(400).json({
          message: err.message,
        });
      }
      console.error('Unexpected error:', err.message);
      return res.status(500).json({
        message: 'An unexpected error occurred while uploading the file.',
      });
    }

    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Token is missing' });
      }

      const decodedToken = jwt.verify(token, secret_key);
      const userId = decodedToken.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized token' });
      }

      const { id, Url_Name, custom_ticker } = req.body; // Add settings to destructuring
      const links = req.body.links || [];
      const method = req.method;
      const apiName = req.originalUrl;

      if (!Url_Name || Url_Name.trim() === '') {
        return res.status(400).json({ message: 'Url_Name is required' });
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
      const validLayouts = ['single', '2x1', '1x2', '2x2', '3x1', '1x3'];

      if (!id || !Array.isArray(links)) {
        return res.status(400).json({ message: 'Invalid request. Please provide a valid ID and links array.' });
      }

      const tickerData = await db.TickerData.findOne({ where: { id } });
      if (!tickerData) {
        return res.status(404).json({ message: 'Record not found' });
      }

      // Process files for PPT/PPTX, DOC/DOCX, and TXT conversions
      const fileConversions = [];

      for (let i = 0; i < links.length; i++) {
        const { link } = links[i];
        const file = req.files.find((f) => f.fieldname === `links[${i}][file]`);

        if (file && (
          file.mimetype === 'application/vnd.ms-powerpoint' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.mimetype === 'application/msword' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.mimetype === 'text/plain'
        )) {
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf('.')) + '.pdf';

          let conversionPromise;
          if (file.mimetype === 'application/vnd.ms-powerpoint' ||
              file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            conversionPromise = convertPptToPdf(originalPath, pdfPath);
          } else if (file.mimetype === 'application/msword' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            conversionPromise = convertDocToPdf(originalPath, pdfPath);
          } else if (file.mimetype === 'text/plain') {
            conversionPromise = convertTxtToPdf(originalPath, pdfPath);
          }

          fileConversions.push({
            index: i,
            promise: conversionPromise,
            originalFile: file,
            pdfPath,
          });
        }
      }

      // Wait for all conversions to complete
      for (const conversion of fileConversions) {
        const success = await conversion.promise;
        if (success) {
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
            size: fs.statSync(conversion.pdfPath).size,
          });

          // Delete original file
          try {
            fs.unlinkSync(originalFile.path);
            logger.log('info', `Deleted original file: ${originalFile.path}`);
          } catch (unlinkError) {
            logger.log('error', `Failed to delete original file ${originalFile.path}: ${unlinkError.message}`);
          }

          console.log(`Converted ${originalFile.filename} to ${pdfFilename}`);
        } else {
          console.error(`Failed to convert file at index ${conversion.index}`);
          return res.status(500).json({
            message: `Failed to convert ${conversion.originalFile.originalname} to PDF`,
          });
        }
      }

      if (req.files && req.files.length > 0) {
        const existingContent = tickerData.url_content || [];
        for (const item of existingContent) {
          const content = item?.content;
          if (content && content.startsWith('/')) {
            const filePath = path.join(
              __dirname,
              `../upload-service/uploads/${username}/${Url_Name}/`,
              content.split('/').pop()
            );
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }

        for (let i = 0; i < links.length; i++) {
          const { link, time, layout, schedule = {}, analyzeWithAI, fileName, custom_ticker } = links[i];
          let contentPath = link;

          const parsedTime = parseInt(time, 10);
          if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
            return res.status(400).json({ message: `Please enter a valid time for item ${i + 1}` });
          }

          if (!link || link.trim() === '') {
            return res.status(400).json({ message: `Please enter valid content for item ${i + 1}` });
          }

          if (layout && !validLayouts.includes(layout)) {
            return res.status(400).json({
              message: `Invalid layout value for item ${i + 1}. Allowed values are: ${validLayouts.join(', ')}`,
            });
          }

          const originalFile = req.files.find((f) => f.fieldname === `links[${i}][file]` && (
            f.mimetype === 'application/vnd.ms-powerpoint' ||
            f.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            f.mimetype === 'application/msword' ||
            f.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            f.mimetype === 'text/plain'
          ));

          const pdfFile = originalFile ?
            req.files.find(f => f.fieldname === originalFile.fieldname &&
              f.mimetype === 'application/pdf' &&
              f !== originalFile) :
            null;

          const file = pdfFile || req.files.find((f) => f.fieldname === `links[${i}][file]`);

          if (link && link.startsWith('blob:') && file) {
            contentPath = `/${username}/${Url_Name}/${file.filename}`;

            if (file.mimetype === 'application/pdf' && analyzeWithAI === 'true') {
              try {
                const pdfPath = path.join(__dirname, `../upload-service/uploads/${username}/${Url_Name}`, file.filename);
                if (fs.existsSync(pdfPath)) {
                  const pdfBuffer = fs.readFileSync(pdfPath);
                  const base64Pdf = pdfBuffer.toString('base64');
                  const response = await axios.post(
                    'http://127.0.0.1:5052/api/summarize',
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
                      originalFormat: originalFile ? path.extname(originalFile.originalname).substring(1) : null,
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

          const originalFormat = originalFile ? path.extname(originalFile.originalname).substring(1) : null;

          mediaData.push({
            content: contentPath,
            time: parsedTime,
            layout: layout || 'single',
            schedule: validatedSchedule,
            fileName: pdfFile ? pdfFile.filename : fileName,
            custom_ticker,
            originalFormat,
          });
        }
      } else {
        for (let i = 0; i < links.length; i++) {
          const { link, time, layout, schedule = {} } = links[i];
          const parsedTime = parseInt(time, 10);
          if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
            return res.status(400).json({ message: `Please enter a valid time for item ${i + 1}` });
          }

          if (!link || link.trim() === '') {
            return res.status(400).json({ message: `Please enter valid content for item ${i + 1}` });
          }

          if (layout && !validLayouts.includes(layout)) {
            return res.status(400).json({
              message: `Invalid layout value for item ${i + 1}. Allowed values are: ${validLayouts.join(', ')}`,
            });
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
            content: link,
            time: parsedTime,
            layout: layout || 'single',
            schedule: validatedSchedule,
          });
        }
      }

      await tickerData.update({
        url_content: mediaData,
        Url_Name: req.body.Url_Name,
        url: req.body.Url_Name,
        custom_ticker: custom_ticker || '',
        // settings: settings || tickerData.settings, // Update settings if provided, otherwise keep existing
      });

      const previewUrl = `${baseURL}/${tickerData.url}`;

      logger.logUserActivity(method, apiName, {
        user_id: userId,
        previewUrl: previewUrl,
        message: `URLs Updated successfully By User ${userId}`,
        Updated_id: `${tickerData.id}`,
      });

      res.json({
        message: 'URL content updated successfully',
        data: {
          id: tickerData.id,
          user_id: tickerData.user_id,
          url_content: tickerData.url_content,
          custom_ticker: tickerData.custom_ticker,
          // settings: tickerData.settings, // Include settings in response
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

router.post('/existingUrl', async (req, res) => {
  const { userId } = req.body;

  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token is missing' });
  }

  try {
    jwt.verify(token, secret_key);

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

    const tickerData = await db.TickerData.findOne({ where: { id } });
    if (!tickerData) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const user = await db.User.findOne({ where: { id: userId }, attributes: ['username'] });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const username = user.username;
    const urlName = tickerData.Url_Name;

    if (tickerData.url_content && Array.isArray(tickerData.url_content)) {
      logger.log('info', `Deleting ${tickerData.url_content.length} files for URL ID: ${id}`);
      for (const item of tickerData.url_content) {
        if (item.content && typeof item.content === 'string' && item.content.startsWith('/')) {
          try {
            const relativePath = item.content.substring(1);
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
          }
        }
      }
    }

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
          for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.log('info', `Forced deletion of file: ${filePath}`);
            }
          }
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
    }

    await tickerData.destroy();

    logger.logUserActivity(method, apiName, {
      user_id: userId,
      urlName: tickerData.Url_Name,
      message: `URL and all associated files deleted successfully by User ${userId}`,
      deleted_Id: id,
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

    res.json({
      ...tickerData.toJSON(),
      settings: tickerData.settings, // Include settings in the response
    });
  } catch (error) {
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({ message: 'Error fetching preview content' });
  }
});

router.get('/server-time', (req, res) => {
  try {
    const istTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    res.json({
      serverTime: new Date(istTime).toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching server time' });
  }
});

router.put('/toggleUrlStatus', async (req, res) => {
  try {
    const { id, status, scheduledAt, expiresAt } = req.body;

    const updateData = {
      isEnabled: status,
      scheduledAt: scheduledAt || null,
      expiresAt: expiresAt || null,
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
      error: error.message,
    });
  }
});

router.get('/parse-rss', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    let response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
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

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('rss')) {
      return res.status(415).json({
        error: 'Invalid content type',
        details: `Expected XML content but received: ${contentType}`,
      });
    }

    const text = await response.text();
    const parser = new xml2js.Parser();
    parser.parseString(text, (err, result) => {
      if (err) {
        return res.status(422).json({
          error: 'Failed to parse RSS',
          details: err.message,
        });
      }

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

router.post('/saveSettings', async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: Token is missing' });
    }

    const tokenValue = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    const decodedToken = jwt.verify(tokenValue, secret_key);
    const userId = decodedToken.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    const { id, settings } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ message: 'Invalid request. Please provide a valid numeric ID.' });
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid settings. Please provide a valid settings object.' });
    }

    const tickerData = await db.TickerData.findOne({ where: { id, user_id: userId } });

    if (!tickerData) {
      return res.status(404).json({ message: `Record not found for ID ${id} and User ${userId}` });
    }

    const validPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    if (settings.dateTime && !validPositions.includes(settings.dateTime.position)) {
      return res.status(400).json({ message: 'Invalid dateTime position' });
    }
    if (settings.temperature && !validPositions.includes(settings.temperature.position)) {
      return res.status(400).json({ message: 'Invalid temperature position' });
    }
    if (settings.ticker) {
      if (settings.ticker.speed < 100 || settings.ticker.speed > 600) {
        return res.status(400).json({ message: 'Ticker speed must be between 10 and 60 seconds' });
      }
      if (settings.ticker.height < 50 || settings.ticker.height > 80) {
        return res.status(400).json({ message: 'Ticker height must be between 30 and 100 pixels' });
      }
      if (settings.ticker.fontSize < 14 || settings.ticker.fontSize > 26) {
        return res.status(400).json({ message: 'Ticker font size must be between 12 and 24 pixels' });
      }
    }

    await tickerData.update({ settings });

    logger.logUserActivity(req.method, req.originalUrl, {
      user_id: userId,
      message: `Settings updated successfully for TickerData ID ${id} by User ${userId}`,
    });

    res.json({
      message: 'Settings updated successfully',
      settings: tickerData.settings,
    });
  } catch (error) {
    console.error('Error saving settings:', error.message);
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({
      message: 'Failed to save settings',
      error: error.message,
    });
  }
});

router.get('/getSettings/:id', async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid ID. ID must be a number.' });
  }

  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: Token is missing' });
    }

    const tokenValue = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    const decodedToken = jwt.verify(tokenValue, secret_key);
    const userId = decodedToken.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    const tickerData = await db.TickerData.findOne({ where: { id, user_id: userId } });

    if (!tickerData) {
      return res.status(404).json({ message: `Record not found for ID ${id} and User ${userId}` });
    }

    res.json({
      settings: tickerData.settings || defaultSettings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error.message);
    logger.log('error', `Error occurred: ${error.message}`);
    res.status(500).json({
      message: 'Error fetching settings',
      error: error.message,
    });
  }
});

module.exports = router;