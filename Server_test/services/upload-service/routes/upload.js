const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../../../models");
const jwt = require("jsonwebtoken");
const xml2js = require("xml2js");
const router = express.Router();
const axios = require("axios");
const licenseMiddleware = require("../middlewares/licenseMiddleware");
const logger = require("../../../Utility/logger");
const { ipAddress } = require("../../../config/ipAddress");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { getIO } = require('../../../Socket_IO');
const PDFDocument = require("pdfkit");
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const secret_key = "TickerApplication";
const encryptedLimit = "e7ZLZFFrXSiP/1U2FOvj4w==";
const secretUrlKey = "9ATicker";
const baseURL = `https://122.179.140.84:4012`;
// const baseURL = `http://192.168.1.27:3000`;
let userId;
let username;
// Helper to broadcast updates
function broadcastUpdate(url, data, eventName = 'update') {
  const io = getIO();
  io.to(url).emit(eventName, data);
  logger.log('info', `Broadcasted ${eventName} to room ${url}`);
  console.log('info', `Broadcasted ${eventName} to room ${url}`);
}
// Helper to convert PPT/PPTX slides to images
async function convertPptToImages(inputPath, outputDir, baseFileName) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    // Normalize paths for cross-platform compatibility
    const normalizedInputPath = path.normalize(inputPath);
    const normalizedOutputDir = path.normalize(outputDir);
    console.log(`Converting PPT: ${normalizedInputPath}`);
    console.log(`Output directory: ${normalizedOutputDir}`);
    console.log(`Base file name: ${baseFileName}`);
    // CRITICAL FIX: Use PDF as intermediate format, then convert to images
    // LibreOffice PNG export only exports first slide by default
   
    // Step 1: Convert PPT to PDF (preserves all slides)
    const pdfPath = path.join(normalizedOutputDir, `${baseFileName}.pdf`);
    const pdfCommand = `soffice --headless --convert-to pdf --outdir "${normalizedOutputDir.replace(/\\/g, '/')}" "${normalizedInputPath.replace(/\\/g, '/')}"`;
    console.log(`Step 1 - Converting to PDF: ${pdfCommand}`);
    const { stdout: pdfStdout, stderr: pdfStderr } = await execAsync(pdfCommand);
    console.log('LibreOffice PDF stdout:', pdfStdout);
    if (pdfStderr) console.error('LibreOffice PDF stderr:', pdfStderr);
    // Wait for PDF conversion to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Verify PDF was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF conversion failed - file not found: ${pdfPath}`);
    }
    // Step 2: Convert PDF pages to PNG images using ImageMagick 7.x
    // Using 'magick' command for ImageMagick 7+
    const outputPattern = path.join(normalizedOutputDir, `${baseFileName}-%d.png`).replace(/\\/g, '/');
    const imageMagickCommand = `magick "${pdfPath.replace(/\\/g, '/')}" -density 300 -quality 100 "${outputPattern}"`;
    console.log(`Step 2 - Converting PDF to PNGs using ImageMagick: ${imageMagickCommand}`);
   
    const { stdout: imStdout, stderr: imStderr } = await execAsync(imageMagickCommand, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
    });
    console.log('ImageMagick stdout:', imStdout);
    if (imStderr) console.error('ImageMagick stderr:', imStderr);
    // Wait for image conversion to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Get all PNG files that match the output pattern
    let pngFiles = fs.readdirSync(normalizedOutputDir)
      .filter(f => {
        // Match patterns like: baseFileName-1.png, baseFileName-2.png, etc.
        const regex = new RegExp(`^${baseFileName}[-]?\\d*\\.png$`, 'i');
        return regex.test(f);
      })
      .sort((a, b) => {
        // Extract page numbers from filenames
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    console.log(`Found ${pngFiles.length} PNG files:`, pngFiles);
    // If still no files, throw an error
    if (pngFiles.length === 0) {
      throw new Error('No PNG files generated during conversion. Ensure pdftoppm or ImageMagick is installed.');
    }
    // Clean up the intermediate PDF file
    try {
      fs.unlinkSync(pdfPath);
      console.log(`Deleted intermediate PDF: ${pdfPath}`);
    } catch (unlinkError) {
      console.error(`Failed to delete intermediate PDF ${pdfPath}:`, unlinkError.message);
    }
    logger.log('info', `Successfully converted ${inputPath} to ${pngFiles.length} images`);
    return pngFiles.map(f => path.join(normalizedOutputDir, f));
  } catch (error) {
    console.error('Error converting PPT/PPTX to images:', error);
    logger.log('error', `Conversion error: ${error.message}`);
    throw error;
  }
}
async function convertDocToPdf(inputPath, outputPath) {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    // Normalize paths for cross-platform compatibility
    const normalizedInputPath = path.normalize(inputPath);
    const normalizedOutputDir = path.normalize(outputDir);
    const outputFileName = path.basename(outputPath);
    console.log(`Converting DOC: ${normalizedInputPath} to ${outputPath}`);
    // Use LibreOffice to convert DOC/DOCX to PDF
    const command = `soffice --headless --convert-to pdf --outdir "${normalizedOutputDir.replace(/\\/g, '/')}" "${normalizedInputPath.replace(/\\/g, '/')}"`;
    console.log(`Executing command: ${command}`);
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    console.log('LibreOffice stdout:', stdout);
    if (stderr) console.error('LibreOffice stderr:', stderr);
    // Wait briefly to ensure file is written
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Verify PDF was created
    if (!fs.existsSync(outputPath)) {
      throw new Error(`PDF conversion failed - file not found: ${outputPath}`);
    }
    logger.log('info', `Successfully converted ${inputPath} to PDF at ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Error converting DOC/DOCX to PDF:', error);
    logger.log('error', `Conversion error: ${error.message}`);
    return false;
  }
}
async function convertTxtToPdf(inputPath, outputPath) {
  try {
    const textContent = fs.readFileSync(inputPath, "utf8");
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);
    doc.fontSize(12).text(textContent, {
      align: "left",
      wordSpacing: 1,
      lineGap: 2,
    });
    doc.end();
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    logger.log("info", `Successfully converted ${inputPath} to PDF`);
    return true;
  } catch (error) {
    console.error("Error converting TXT to PDF:", error);
    logger.log("error", `Conversion error for ${inputPath}: ${error.message}`);
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
        attributes: ["username"],
      });
      if (!user) {
        return cb(new Error("User not found"));
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
      console.error("Error setting up multer storage:", err);
      logger.log("error", `Error occurred: ${err.message}`);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const originalName = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${originalName}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 524288000 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/svg+xml",
      "video/mp4",
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error(`Unsupported file type: ${file.mimetype}`);
      error.code = "LIMIT_UNSUPPORTED_FILE_TYPE";
      return cb(error, false);
    }
    cb(null, true);
  },
}).any();

router.post("/upload", licenseMiddleware, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        logger.log("error", `File size error: ${err.message}`);
        return res.status(400).json({
          message: `File size exceeds the limit of 500 MB. Please upload a smaller file.`,
        });
      }
      if (err.code === "LIMIT_UNSUPPORTED_FILE_TYPE") {
        console.error("Invalid file type error:", err.message);
        return res.status(400).json({
          message: err.message,
        });
      }
      logger.log("error", `Error occurred: ${err.message}`);
      return res.status(500).json({ message: err.message });
    }
    console.log("req.body:", req.body);
    console.log("req.files:", req.files);
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
      logger.log("error", `Error occurred: Missing Token`);
      return res.status(401).json({ message: "Unauthorized: Token is missing" });
    }
    try {
      const decoded = jwt.verify(token, secret_key);
      const accountId = 1;
      const user = await db.User.findOne({
        where: { id: decoded.userId },
        include: [{ model: db.Account, attributes: ['accountName'] }],
      });
      if (!user || !user.Account) {
        return res.status(400).json({ message: "User or account not found" });
      }
      const accountName = user.Account.accountName;
      if (links.length === 0) {
        return res.status(400).json({
          message: "No content provided. Please add at least one link or file.",
        });
      }
      const MAX_URL_LIMIT = 10;
      const accountUrlCount = await db.TickerData.count({
        where: { account_id: accountId },
      });
      if (accountUrlCount >= MAX_URL_LIMIT) {
        return res.status(403).json({
          message: "Account has reached the maximum allowed URLs. Please contact Admin or delete an existing URL to create a new one.",
        });
      }
      if (!Url_Name || Url_Name.trim() === "") {
        return res.status(400).json({ message: "Url_Name is required" });
      }
      const reservedKeywords = [
        "login",
        "logout",
        "admin",
        "admin-dashboard",
        "home",
        "settings",
        "register",
        "editurl",
      ];
            
      // Check for reserved keywords (case-insensitive)
      if (reservedKeywords.includes(Url_Name.toLowerCase())) {
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is reserved and cannot be used. Please choose a different name.`,
        });
      }
      
      // Check if the URL name already exists for the account
      const existingUrl = await db.TickerData.findOne({
        where: { Url_Name, account_id: accountId },
      });
      
      if (existingUrl) {
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is already taken for this account. Please choose a different name.`,
        });
      }
   
      const mediaData = [];
      const accountUploadDir = `./upload-service/uploads/${username}`;
      const flaskApiUrl = "http://127.0.0.1:5052/api/summarize";
     
      for (let i = 0; i < links.length; i++) {
        const {
          link,
          time,
          analyzeWithAI,
          schedule = {},
          fileName,
          layout,
          custom_ticker,
        } = links[i];
        let contentPath = link;
        const parsedTime = parseInt(time, 10);
        if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
          return res.status(400).json({ message: `Please enter a valid time for item ${i + 1}` });
        }
        if (
          !link &&
          !req.files.some((f) => f.fieldname === `links[${i}][file]`)
        ) {
          return res.status(400).json({
            message: `No link or file provided for item ${i + 1}.`,
          });
        }
        const file = req.files.find((f) => f.fieldname === `links[${i}][file]`);
       
        // Handle PPT/PPTX files - convert to multiple slide images
        if (file && (
          file.mimetype === "application/vnd.ms-powerpoint" ||
          file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )) {
          console.log(`Processing PPT file: ${file.originalname}`);
          const originalPath = file.path;
          const outputDir = path.join(accountUploadDir, Url_Name);
          const baseFileName = path.parse(file.originalname).name;
          const groupId = uuidv4();
          const slideImages = await convertPptToImages(originalPath, outputDir, baseFileName);
         
          if (slideImages.length === 0) {
            return res.status(500).json({
              message: `Failed to convert ${file.originalname} to slide images`,
            });
          }
         
          console.log(`Adding ${slideImages.length} slide images to mediaData`);
          // Add ALL slide images as separate media items
          for (const [slideIndex, slidePath] of slideImages.entries()) {
            const slideFilename = path.basename(slidePath);
            mediaData.push({
              content: `/${username}/${Url_Name}/${slideFilename}`,
              time: parsedTime, // Use the same time for each slide
              schedule,
              fileName: slideFilename,
              layout: "single",
              custom_ticker,
              originalFormat: path.extname(file.originalname).toLowerCase().substring(1),
              groupId,
              slideNumber: slideIndex,
            });
            console.log(`Added slide: ${slideFilename}`);
          }
         
          // Delete the original PPT file after processing all slides
          try {
            fs.unlinkSync(originalPath);
            logger.log("info", `Deleted original PPT file: ${originalPath}`);
          } catch (unlinkError) {
            logger.log("error", `Failed to delete original PPT file ${originalPath}: ${unlinkError.message}`);
          }
          continue; // Skip the rest of the loop for this file since we've processed all slides
        }
        // Handle DOC/DOCX files
        else if (file && (
          file.mimetype === "application/msword" ||
          file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )) {
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf(".")) + ".pdf";
          const success = await convertDocToPdf(originalPath, pdfPath);
          if (success) {
            const pdfFilename = path.basename(pdfPath);
            contentPath = `/${username}/${Url_Name}/${pdfFilename}`;
            if (file.mimetype === "application/pdf" && analyzeWithAI === "true") {
              try {
                const pdfBuffer = fs.readFileSync(pdfPath);
                const base64Pdf = pdfBuffer.toString("base64");
                const response = await axios.post(
                  flaskApiUrl,
                  { pdf: base64Pdf, filename: pdfFilename },
                  { headers: { "Content-Type": "application/json" } }
                );
                if (response.data && response.data.summary) {
                  mediaData.push({
                    content: contentPath,
                    time: parsedTime,
                    summary: response.data.summary,
                    schedule,
                    fileName: pdfFilename,
                    layout,
                    custom_ticker,
                    originalFormat: path.extname(file.originalname).substring(1),
                  });
                  continue;
                }
              } catch (flaskError) {
                console.error("Failed to summarize PDF:", flaskError);
              }
            }
            mediaData.push({
              content: contentPath,
              time: parsedTime,
              schedule,
              fileName: pdfFilename,
              layout,
              custom_ticker,
              originalFormat: path.extname(file.originalname).substring(1),
            });
            try {
              fs.unlinkSync(originalPath);
              logger.log("info", `Deleted original DOC file: ${originalPath}`);
            } catch (unlinkError) {
              logger.log("error", `Failed to delete original DOC file ${originalPath}: ${unlinkError.message}`);
            }
          } else {
            return res.status(500).json({
              message: `Failed to convert ${file.originalname} to PDF`,
            });
          }
        }
        // Handle TXT files
        else if (file && file.mimetype === "text/plain") {
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf(".")) + ".pdf";
          const success = await convertTxtToPdf(originalPath, pdfPath);
          if (success) {
            const pdfFilename = path.basename(pdfPath);
            contentPath = `/${username}/${Url_Name}/${pdfFilename}`;
            mediaData.push({
              content: contentPath,
              time: parsedTime,
              schedule,
              fileName: pdfFilename,
              layout,
              custom_ticker,
              originalFormat: "txt",
            });
            try {
              fs.unlinkSync(originalPath);
              logger.log("info", `Deleted original TXT file: ${originalPath}`);
            } catch (unlinkError) {
              logger.log("error", `Failed to delete original TXT file ${originalPath}: ${unlinkError.message}`);
            }
          } else {
            return res.status(500).json({
              message: `Failed to convert ${file.originalname} to PDF`,
            });
          }
        }
        // Handle other file types (images, videos, PDFs)
        else if (link && link.startsWith("blob:") && file) {
          contentPath = `/${username}/${Url_Name}/${file.filename}`;
          if (file.mimetype === "application/pdf" && analyzeWithAI === "true") {
            try {
              const pdfPath = path.join(accountUploadDir, Url_Name, file.filename);
              if (fs.existsSync(pdfPath)) {
                const pdfBuffer = fs.readFileSync(pdfPath);
                const base64Pdf = pdfBuffer.toString("base64");
                const response = await axios.post(
                  flaskApiUrl,
                  { pdf: base64Pdf, filename: file.filename },
                  { headers: { "Content-Type": "application/json" } }
                );
                if (response.data && response.data.summary) {
                  mediaData.push({
                    content: contentPath,
                    time: parsedTime,
                    summary: response.data.summary,
                    schedule,
                    fileName,
                    layout,
                    custom_ticker,
                    originalFormat: null,
                  });
                  continue;
                }
              } else {
                console.error(`PDF file does not exist at path: ${pdfPath}`);
              }
            } catch (flaskError) {
              console.error("Failed to summarize PDF:", flaskError);
            }
          }
          mediaData.push({
            content: contentPath,
            time: parsedTime,
            schedule,
            fileName,
            layout,
            custom_ticker,
            originalFormat: null,
          });
        }
        // Handle external links
        else if (link && !link.startsWith("blob:")) {
          contentPath = link;
          mediaData.push({
            content: contentPath,
            time: parsedTime,
            schedule,
            fileName,
            layout,
            custom_ticker,
            originalFormat: null,
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
        if (typeof validatedSchedule.weeklyDays === "string") {
          try {
            validatedSchedule.weeklyDays = JSON.parse(validatedSchedule.weeklyDays);
          } catch (e) {
            validatedSchedule.weeklyDays = [];
          }
        }
        if (!Array.isArray(validatedSchedule.weeklyDays)) {
          validatedSchedule.weeklyDays = [];
        }
      }
     
      console.log(`Final mediaData contains ${mediaData.length} items:`, mediaData);
     
      const uniqueUrl = `${Url_Name}`;
      const newTickerData = await db.TickerData.create({
        user_id: userId,
        account_id: accountId,
        url_content: mediaData,
        url: uniqueUrl,
        Url_Name: Url_Name,
        custom_ticker: custom_ticker,
      });
     
      broadcastUpdate(uniqueUrl, newTickerData.toJSON(), 'init');
      logger.logUserActivity(method, apiName, {
        user_id: userId,
        account_id: accountId,
        previewUrl: `${baseURL}/${uniqueUrl}`,
        message: `URLs and files created successfully by User ${userId} for Account ${accountName}`,
      });
     
      res.json({
        message: "URLs and files created successfully",
        previewUrl: `${baseURL}/${uniqueUrl}`,
        totalSlides: mediaData.length
      });
    } catch (error) {
      console.error("Error saving data:", error);
      logger.log("error", `Error occurred: ${error.message}`);
      res.status(500).json({ message: "Failed to save data" });
    }
  });
});

router.patch("/updateUrlContent", licenseMiddleware, async (req, res) => {
  console.log('licenseMiddleware called for:', req.method, req.originalUrl);
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        console.error("File size error:", err.message);
        return res.status(400).json({
          message: "File size exceeds the limit of 500MB. Please upload a smaller file.",
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
        return res.status(401).json({ message: "Unauthorized: Token is missing" });
      }
      const decoded = jwt.verify(token, secret_key);
      const userId = decoded.userId;
      const accountId = decoded.accountId || 1; // Fallback to 1 if not present
      const user = await db.User.findOne({
        where: { id: userId },
        include: [{ model: db.Account, attributes: ['accountName'] }],
      });
      if (!user || !user.Account) {
        return res.status(400).json({ message: "User or account not found" });
      }
      const accountName = user.Account.accountName;
      username = user.username; // Set username here as well
      const { id, Url_Name, custom_ticker } = req.body;
      const links = Array.isArray(req.body.links) ? req.body.links : [];
      const method = req.method;
      const apiName = req.originalUrl;
     
      if (!Url_Name || Url_Name.trim() === "") {
        return res.status(400).json({ message: "Url_Name is required" });
      }
     
      const reservedKeywords = [
        "login",
        "logout",
        "admin",
        "admin-dashboard",
        "home",
        "settings",
        "register",
        "editurl",
      ];
            
      // Check for reserved keywords (case-insensitive)
      if (reservedKeywords.includes(Url_Name.toLowerCase())) {
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is reserved and cannot be used. Please choose a different name.`,
        });
      }
      
      // Check if the URL name already exists for the account
      const existingUrl = await db.TickerData.findOne({
        where: { Url_Name, account_id: accountId },
      });
      
      if (existingUrl && existingUrl.id !== parseInt(id)) {  // Exclude self
        return res.status(400).json({
          message: `The Url_Name "${Url_Name}" is already taken for this account. Please choose a different name.`,
        });
      }
          
      const mediaData = [];
      const validLayouts = ["single", "2x1", "1x2", "2x2", "3x1", "1x3"];
      const accountUploadDir = `./upload-service/uploads/${username}`;
     
      if (!id || !Array.isArray(links)) {
        return res.status(400).json({
          message: "Invalid request. Please provide a valid ID and links array.",
        });
      }
     
      const tickerData = await db.TickerData.findOne({ where: { id, account_id: accountId } });
      if (!tickerData) {
        return res.status(404).json({ message: "Record not found for this account" });
      }
     
      // Track files to delete (only files that are being replaced)
      const filesToDelete = new Set();
     
      // STEP 1: Collect groups to prune (for PPT replacement)
      const groupsToPrune = new Set();  // groupIds to skip old slides
     
      // STEP 2: Convert files first (PPT, DOC, TXT)
      const convertedFiles = new Map(); // Map original file index to converted files
     
      for (let i = 0; i < links.length; i++) {
        const linkObj = links[i];
        const { link } = linkObj;
        const replacePpt = linkObj.replacePpt === 'true';  // FormData strings
        const originalGroupId = linkObj.originalGroupId || null;
        const file = req.files.find((f) => f.fieldname === `links[${i}][file]`);
       
        // If this is a new file upload (blob:), mark old file for deletion
        if (file && link && link.startsWith("blob:")) {
          const existingContent = tickerData.url_content || [];
          if (existingContent[i] && existingContent[i].content && existingContent[i].content.startsWith("/")) {
            const oldFilePath = path.join(
              accountUploadDir,
              Url_Name,
              existingContent[i].content.split("/").pop()
            );
            filesToDelete.add(oldFilePath);
            console.log(`Marked for deletion: ${oldFilePath}`);
          }
        }
       
        // Handle PPT/PPTX conversion
        if (
          file &&
          (file.mimetype === "application/vnd.ms-powerpoint" ||
            file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        ) {
          console.log(`Processing PPT file for update: ${file.originalname}`);
          const originalPath = file.path;
          const outputDir = path.join(accountUploadDir, Url_Name);
          const baseFileName = path.parse(file.originalname).name;
          const newGroupId = uuidv4(); // New groupId for newly uploaded PPT
         
          const slideImages = await convertPptToImages(originalPath, outputDir, baseFileName);
         
          if (slideImages.length === 0) {
            return res.status(500).json({
              message: `Failed to convert ${file.originalname} to slide images`,
            });
          }
         
          console.log(`Converted ${file.originalname} to ${slideImages.length} slides`);
         
          // Store converted slides with groupId
          convertedFiles.set(i, {
            type: 'ppt',
            slides: slideImages.map((slidePath, slideIndex) => ({
              filename: path.basename(slidePath),
              path: slidePath,
              mimetype: 'image/png',
              slideNumber: slideIndex,
              groupId: newGroupId,
            })),
            originalFormat: path.extname(file.originalname).toLowerCase().substring(1),
            originalGroupId: originalGroupId  // Preserve for pruning
          });
         
          // If replacing, add old group to prune set
          if (replacePpt && originalGroupId) {
            groupsToPrune.add(originalGroupId);
            console.log(`Marking group for prune on PPT replace: ${originalGroupId}`);
          }
         
          // Delete original PPT file
          try {
            fs.unlinkSync(originalPath);
            logger.log("info", `Deleted original PPT file: ${originalPath}`);
          } catch (unlinkError) {
            logger.log("error", `Failed to delete original PPT file ${originalPath}: ${unlinkError.message}`);
          }
        }
        // Handle DOC/DOCX conversion
        else if (
          file &&
          (file.mimetype === "application/msword" ||
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        ) {
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf(".")) + ".pdf";
         
          const success = await convertDocToPdf(originalPath, pdfPath);
         
          if (success) {
            const pdfFilename = path.basename(pdfPath);
           
            // Store converted PDF info
            convertedFiles.set(i, {
              type: 'doc',
              filename: pdfFilename,
              path: pdfPath,
              mimetype: 'application/pdf',
              originalFormat: path.extname(file.originalname).toLowerCase().substring(1)
            });
           
            // Delete original DOC file
            try {
              fs.unlinkSync(originalPath);
              logger.log("info", `Deleted original DOC file: ${originalPath}`);
            } catch (unlinkError) {
              logger.log("error", `Failed to delete original DOC file ${originalPath}: ${unlinkError.message}`);
            }
           
            console.log(`Converted ${file.originalname} to ${pdfFilename}`);
          } else {
            return res.status(500).json({
              message: `Failed to convert ${file.originalname} to PDF`,
            });
          }
        }
        // Handle TXT conversion
        else if (file && file.mimetype === "text/plain") {
          const originalPath = file.path;
          const pdfPath = originalPath.substring(0, originalPath.lastIndexOf(".")) + ".pdf";
         
          const success = await convertTxtToPdf(originalPath, pdfPath);
         
          if (success) {
            const pdfFilename = path.basename(pdfPath);
           
            // Store converted PDF info
            convertedFiles.set(i, {
              type: 'txt',
              filename: pdfFilename,
              path: pdfPath,
              mimetype: 'application/pdf',
              originalFormat: 'txt'
            });
           
            // Delete original TXT file
            try {
              fs.unlinkSync(originalPath);
              logger.log("info", `Deleted original TXT file: ${originalPath}`);
            } catch (unlinkError) {
              logger.log("error", `Failed to delete original TXT file ${originalPath}: ${unlinkError.message}`);
            }
           
            console.log(`Converted ${file.originalname} to ${pdfFilename}`);
          } else {
            return res.status(500).json({
              message: `Failed to convert ${file.originalname} to PDF`,
            });
          }
        }
      }
     
      // STEP 3: Delete only the files that are being replaced
      for (const filePath of filesToDelete) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`Deleted old file: ${filePath}`);
          } catch (unlinkErr) {
            console.error(`Failed to delete ${filePath}:`, unlinkErr.message);
          }
        }
      }
     
      // STEP 4: Build mediaData array
      for (let i = 0; i < links.length; i++) {
        const {
          link,
          time,
          layout,
          schedule = {},
          analyzeWithAI,
          fileName,
          custom_ticker,
          groupId: requestGroupId,  // Rename to avoid conflict
          originalGroupId,
          replacePpt,
        } = links[i];
       
        let contentPath = link;
        const parsedTime = parseInt(time, 10);
       
        if (!parsedTime || isNaN(parsedTime) || parsedTime <= 0) {
          return res.status(400).json({ message: `Please enter a valid time for item ${i + 1}` });
        }
        if (!link || link.trim() === "") {
          return res.status(400).json({
            message: `Please enter valid content for item ${i + 1}`,
          });
        }
        if (layout && !validLayouts.includes(layout)) {
          return res.status(400).json({
            message: `Invalid layout value for item ${i + 1}. Allowed values are: ${validLayouts.join(", ")}`,
          });
        }
       
        // Validate and normalize schedule
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
        if (typeof validatedSchedule.weeklyDays === "string") {
          try {
            validatedSchedule.weeklyDays = JSON.parse(validatedSchedule.weeklyDays);
          } catch (e) {
            validatedSchedule.weeklyDays = [];
          }
        }
        if (!Array.isArray(validatedSchedule.weeklyDays)) {
          validatedSchedule.weeklyDays = [];
        }
       
        // Check if this link has converted files
        const converted = convertedFiles.get(i);
        const effectiveGroupId = requestGroupId || null;
       
        if (converted && link && link.startsWith("blob:")) {
          if (converted.type === 'ppt') {
            // Add all slides
            console.log(`Adding ${converted.slides.length} slides to mediaData for link ${i}`);
            for (const slide of converted.slides) {
              contentPath = `/${username}/${Url_Name}/${slide.filename}`;
              mediaData.push({
                content: contentPath,
                time: parsedTime,
                schedule: validatedSchedule,
                fileName: slide.filename,
                layout: "single",
                custom_ticker,
                originalFormat: converted.originalFormat,
                groupId: slide.groupId,  // Use the new groupId for new PPT
                slideNumber: slide.slideNumber,
              });
              console.log(`Added slide to mediaData: ${slide.filename}`);
            }
          } else {
            // Add converted PDF (from DOC or TXT)
            contentPath = `/${username}/${Url_Name}/${converted.filename}`;
            mediaData.push({
              content: contentPath,
              time: parsedTime,
              schedule: validatedSchedule,
              fileName: converted.filename, // Use PDF filename, not original
              layout,
              custom_ticker,
              originalFormat: converted.originalFormat,
              groupId: effectiveGroupId,
            });
            console.log(`Added converted file to mediaData: ${converted.filename}`);
          }
        } else if (link && link.startsWith("blob:")) {
          // Regular file upload (image, video, PDF) - this handles individual slide replacement
          const file = req.files.find((f) => f.fieldname === `links[${i}][file]`);
          if (file) {
            contentPath = `/${username}/${Url_Name}/${file.filename}`;
            mediaData.push({
              content: contentPath,
              time: parsedTime,
              schedule: validatedSchedule,
              fileName: file.filename,
              layout,
              custom_ticker,
              originalFormat: null,
              groupId: effectiveGroupId,  // Preserve groupId for individual replacements
            });
          }
        } else if (link && !link.startsWith("blob:")) {
          // Existing content (preserve original groupId)
          contentPath = link;
          // For existing items, check if it had a groupId in the original data
          const existingItem = tickerData.url_content.find(item => item.content === link);
          const preservedGroupId = existingItem ? existingItem.groupId : effectiveGroupId;
          // Skip if this is an old slide in a pruned group
          if (groupsToPrune.has(preservedGroupId)) {
            console.log(`Skipping old slide in pruned group: ${link} (groupId: ${preservedGroupId})`);
            continue;  // Skip adding to mediaData
          }
          mediaData.push({
            content: contentPath,
            time: parsedTime,
            schedule: validatedSchedule,
            fileName,
            layout,
            custom_ticker,
            originalFormat: null,
            groupId: preservedGroupId,
          });
        }
      }
     
      // Clean up unused local files from previous content
      const oldUrlContent = tickerData.url_content || [];
      const oldLocalFiles = oldUrlContent
        .filter(c => c.content && c.content.startsWith('/'))
        .map(c => path.basename(c.content));
      const newLocalFiles = mediaData
        .filter(m => m.content && m.content.startsWith('/'))
        .map(m => path.basename(m.content));
      const unusedFiles = oldLocalFiles.filter(f => !newLocalFiles.includes(f));
      for (const filename of unusedFiles) {
        const filePath = path.join(accountUploadDir, Url_Name, filename);
        if (fs.existsSync(filePath)) {
          console.log(`Deleting unused file: ${filePath}`);  // Enhanced logging
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error(`Failed to delete unused file ${filePath}:`, err);
          }
        }
      }
     
      console.log(`Final mediaData for update contains ${mediaData.length} items`);
      console.log(`Pruned ${groupsToPrune.size} PPT groups to avoid duplicates`);
     
      await tickerData.update({
        url_content: mediaData,
        Url_Name: req.body.Url_Name,
        url: req.body.Url_Name,
        custom_ticker: custom_ticker || "",
      });
     
      const previewUrl = `${baseURL}/${tickerData.url}`;
      broadcastUpdate(Url_Name, tickerData.toJSON());
     
      logger.logUserActivity(method, apiName, {
        user_id: userId,
        account_id: accountId,
        previewUrl: previewUrl,
        message: `URLs Updated successfully By User ${userId} for Account ${accountName}`,
        Updated_id: `${tickerData.id}`,
      });
     
      res.json({
        message: "URL content updated successfully",
        data: {
          id: tickerData.id,
          user_id: tickerData.user_id,
          account_id: tickerData.account_id,
          url_content: mediaData,  // Return the new mediaData to frontend
          custom_ticker: tickerData.custom_ticker,
          previewUrl,
          totalSlides: mediaData.length,
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

router.post("/existingUrl", async (req, res) => {
  const { userId } = req.body;
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token is missing" });
  }
  try {
    const actualToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const decoded = jwt.verify(actualToken, secret_key);
    const accountId = decoded.accountId;
    const tickerData = await db.TickerData.findAll({
      where: { account_id: accountId },
    });
    if (!tickerData || tickerData.length === 0) {
      return res.status(409).json({ message: "It looks like you haven't created any URLs yet. Let's get started by creating your first one!" });
    }
    const dataWithPreviewUrls = tickerData.map((item) => ({
      ...item.toJSON(),
      previewUrl: `${baseURL}/${item.url}`,
    }));
    res.json(dataWithPreviewUrls);
  } catch (error) {
    console.error("Error fetching existing URLs or verifying token:", error.message);
    logger.log("error", `Error occurred: ${error.message}`);
    res.status(401).json({ message: "Unauthorized: Invalid or expired token. Please log in again.", error: error.message });
  }
});

router.delete("/deleteUrl", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token is missing" });
  }
  try {
    const decoded = jwt.verify(token, secret_key);
    const userId = decoded.userId;
    const accountId = decoded.accountId;
    const user = await db.User.findOne({
      where: { id: userId },
      include: [{ model: db.Account, attributes: ['accountName'] }],
    });
    if (!user || !user.Account) {
      return res.status(400).json({ message: "User or account not found" });
    }
    const accountName = user.Account.accountName;
    const { id } = req.body;
    const method = req.method;
    const apiName = req.originalUrl;
    if (!id) {
      return res.status(400).json({ message: "Invalid request. Please provide a valid ID." });
    }
    const tickerData = await db.TickerData.findOne({ where: { id, account_id: accountId } });
    if (!tickerData) {
      return res.status(404).json({ message: "Record not found for this account" });
    }
    const urlName = tickerData.Url_Name;
    if (tickerData.url_content && Array.isArray(tickerData.url_content)) {
      logger.log("info", `Deleting ${tickerData.url_content.length} files for URL ID: ${id}`);
      for (const item of tickerData.url_content) {
        if (item.content && typeof item.content === "string" && item.content.startsWith("/")) {
          try {
            const relativePath = item.content.substring(1);
            const filePath = path.join(process.cwd(), "upload-service/uploads", relativePath);
            logger.log("info", `Attempting to delete file: ${filePath}`);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.log("info", `Successfully deleted file: ${filePath}`);
            } else {
              logger.log("warn", `File not found for deletion: ${filePath}`);
            }
          } catch (err) {
            logger.log("error", `Error deleting file: ${err.message}`);
          }
        }
      }
    }
    try {
      const folderPath = path.join(process.cwd(), "upload-service/uploads", username, urlName);
      logger.log("info", `Checking if folder exists: ${folderPath}`);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        logger.log("info", `Folder contains ${files.length} files`);
        if (files.length === 0) {
          fs.rmdirSync(folderPath);
          logger.log("info", `Empty folder deleted: ${folderPath}`);
        } else {
          for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.log("info", `Forced deletion of file: ${filePath}`);
            }
          }
          if (fs.existsSync(folderPath)) {
            fs.rmdirSync(folderPath);
            logger.log("info", `Folder deleted after clearing: ${folderPath}`);
          }
        }
      } else {
        logger.log("info", `Folder does not exist: ${folderPath}`);
      }
    } catch (err) {
      logger.log("error", `Error handling URL folder: ${err.message}`);
    }
    await tickerData.destroy();
    broadcastUpdate(urlName, { id, url: urlName }, 'delete');
    logger.log('info', `Emitted delete event for URL: ${urlName}`);
    logger.logUserActivity(method, apiName, {
      user_id: userId,
      account_id: accountId,
      urlName: tickerData.Url_Name,
      message: `URL and all associated files deleted successfully by User ${userId} for Account ${accountName}`,
      deleted_Id: id,
    });
    res.json({ message: "URL and all associated files deleted successfully" });
  } catch (error) {
    console.error("Error deleting URL data:", error.message);
    logger.log("error", `Error occurred: ${error.message}`);
    res.status(500).json({
      message: "Failed to delete URL data",
      error: error.message,
    });
  }
});

router.post("/preview/:url",licenseMiddleware, async (req, res) => {
  const { url } = req.params;
  try {
    const tickerData = await db.TickerData.findOne({ where: { url } });
    if (!tickerData) {
      return res.status(404).json({ message: "URL not found" });
    }
    res.json({
      ...tickerData.toJSON(),
      settings: tickerData.settings,
    });
  } catch (error) {
    logger.log("error", `Error occurred: ${error.message}`);
    res.status(500).json({ message: "Error fetching preview content" });
  }
});

const moment = require("moment-timezone");

router.put("/toggleUrlStatus", async (req, res) => {
  try {
    const { id, status, scheduledAt, expiresAt } = req.body;
    const scheduledAtIST = scheduledAt
      ? moment.tz(scheduledAt, "UTC").tz("Asia/Kolkata").toDate()
      : null;
    const expiresAtIST = expiresAt
      ? moment.tz(expiresAt, "UTC").tz("Asia/Kolkata").toDate()
      : null;
    const updateData = {
      isEnabled: status,
      scheduledAt: scheduledAtIST,
      expiresAt: expiresAtIST,
    };
    const [updated] = await db.TickerData.update(updateData, { where: { id } });
    if (updated) {
      const updatedUrl = await db.TickerData.findByPk(id);
      if (!updatedUrl) {
        return res.status(404).json({ message: "URL not found" });
      }
      broadcastUpdate(updatedUrl.url, updatedUrl.toJSON(), 'update');
      logger.log('info', `Emitted update event for URL: ${updatedUrl.url}`);
      res.status(200).json(updatedUrl);
    } else {
      res.status(404).json({ message: "URL not found" });
    }
  } catch (error) {
    logger.log('error', `Error updating status: ${error.message}`);
    res.status(500).json({
      message: "Error updating status",
      error: error.message,
    });
  }
});

router.get("/parse-rss", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
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
      // console.error("Error fetching RSS feed:", fetchError.message);
      return res.status(502).json({
        error: "Failed to fetch RSS feed",
        details: fetchError.message,
      });
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("xml") && !contentType.includes("rss")) {
      return res.status(415).json({
        error: "Invalid content type",
        details: `Expected XML content but received: ${contentType}`,
      });
    }
    const text = await response.text();
    const parser = new xml2js.Parser();
    parser.parseString(text, (err, result) => {
      if (err) {
        return res.status(422).json({
          error: "Failed to parse RSS",
          details: err.message,
        });
      }
      if (
        !result ||
        !result.rss ||
        !result.rss.channel ||
        !result.rss.channel[0].item
      ) {
        return res.status(422).json({
          error: "Invalid RSS format",
          details: "The fetched content does not have a valid RSS structure",
        });
      }
      const items = result.rss.channel[0].item.map((item) => ({
        title: item.title ? item.title[0] : "No title",
        description: item.description ? item.description[0] : "No description",
        source: result.rss.channel[0].title
          ? result.rss.channel[0].title[0]
          : "Unknown source",
        url: item.link ? item.link[0] : "",
        publishedAt: item.pubDate ? item.pubDate[0] : new Date().toISOString(),
      }));
      res.json({ items });
    });
  } catch (error) {
    console.error("RSS parsing error:", error);
    res.status(500).json({
      error: "Failed to process RSS feed",
      details: error.message,
    });
  }
});

router.post("/saveSettings", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Token is missing" });
    }
    const tokenValue = token.startsWith("Bearer ")
      ? token.split(" ")[1]
      : token;
    const decodedToken = jwt.verify(tokenValue, secret_key);
    const userId = decodedToken.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    const { id, settings } = req.body;
    if (!id || isNaN(id)) {
      return res.status(400).json({
        message: "Invalid request. Please provide a valid numeric ID.",
      });
    }
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({
        message: "Invalid settings. Please provide a valid settings object.",
      });
    }
    const tickerData = await db.TickerData.findOne({
      where: {
        id,
        // user_id: userId
      },
    });
    if (!tickerData) {
      return res
        .status(404)
        .json({ message: `Record not found for ID ${id} and User ${userId}` });
    }
    const validPositions = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ];
    if (
      settings.dateTime &&
      !validPositions.includes(settings.dateTime.position)
    ) {
      return res.status(400).json({ message: "Invalid dateTime position" });
    }
    if (
      settings.temperature &&
      !validPositions.includes(settings.temperature.position)
    ) {
      return res.status(400).json({ message: "Invalid temperature position" });
    }
    if (settings.ticker) {
      if (settings.ticker.speed < 100 || settings.ticker.speed > 600) {
        return res
          .status(400)
          .json({ message: "Ticker speed must be between 100 and 600 milliseconds" });
      }
      if (settings.ticker.height < 50 || settings.ticker.height > 80) {
        return res
          .status(400)
          .json({ message: "Ticker height must be between 50 and 80 pixels" });
      }
      if (settings.ticker.fontSize < 14 || settings.ticker.fontSize > 26) {
        return res.status(400).json({
          message: "Ticker font size must be between 14 and 26 pixels",
        });
      }
    }
    await tickerData.update({ settings });
    broadcastUpdate(tickerData.url, tickerData.toJSON(), 'update');
    logger.log('info', `Emitted update event for URL: ${tickerData.url} with updated settings`);
    logger.logUserActivity(req.method, req.originalUrl, {
      user_id: userId,
      message: `Settings updated successfully for TickerData ID ${id} by User ${userId}`,
    });
    res.json({
      message: "Settings updated successfully",
      settings: tickerData.settings,
    });
  } catch (error) {
    console.error("Error saving settings:", error.message);
    logger.log("error", `Error occurred: ${error.message}`);
    res.status(500).json({
      message: "Failed to save settings",
      error: error.message,
    });
  }
});

router.get("/getSettings/:id", async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) {
    return res
      .status(400)
      .json({ message: "Invalid ID. ID must be a number." });
  }
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Token is missing" });
    }
    const tokenValue = token.startsWith("Bearer ")
      ? token.split(" ")[1]
      : token;
    const decodedToken = jwt.verify(tokenValue, secret_key);
    const userId = decodedToken.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    const tickerData = await db.TickerData.findOne({
      where: {
        id,
        // user_id: userId
      },
    });
    if (!tickerData) {
      return res
        .status(404)
        .json({ message: `Record not found for ID ${id} and User ${userId}` });
    }
    res.json({
      settings: tickerData.settings || defaultSettings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error.message);
    logger.log("error", `Error occurred: ${error.message}`);
    res.status(500).json({
      message: "Error fetching settings",
      error: error.message,
    });
  }
});

const adminMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    logger.log('error', 'No token provided for admin access');
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, secret_key);
    logger.log('info', `Token decoded: userId=${decoded.userId}, username=${decoded.username}, isAdmin=${decoded.isAdmin}`);
    const user = await db.User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'isAdmin']
    });
    if (!user) {
      logger.log('error', `User not found for ID: ${decoded.userId}`);
      return res.status(401).json({ message: 'Invalid token: User not found' });
    }
    if (user.isAdmin !== true) {
      logger.log('error', `Non-admin user attempted access: username=${user.username}, isAdmin=${user.isAdmin}`);
      return res.status(403).json({ message: 'Admin access required' });
    }
    logger.log('info', `Admin access granted: username=${user.username}, isAdmin=${user.isAdmin}`);
    req.user = user;
    next();
  } catch (error) {
    logger.log('error', `Authentication error: ${error.message}, token=${token}`);
    return res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

router.post('/create-user', adminMiddleware, async (req, res) => {
  const { username, password, accountId = 1, isAdmin } = req.body;
  if (!username || !password) {
    logger.log('error', 'Missing required fields for user creation');
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const account = await db.Account.findByPk(accountId);
    if (!account) {
      logger.log('error', `Account not found for ID: ${accountId}`);
      return res.status(400).json({ message: 'Invalid accountId' });
    }
    const existingUser = await db.User.findOne({ where: { username } });
    if (existingUser) {
      logger.log('error', `Username already taken: ${username}`);
      return res.status(400).json({ message: 'Username already exists' });
    }
    const userCount = await db.User.count();
    if (userCount >= 10) {
      logger.log('warn', 'User creation limit reached');
      return res.status(403).json({ message: 'User creation limit of 10 reached' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await db.User.create({
      username,
      password: hashedPassword,
      accountId,
      isAdmin: !!isAdmin,
    });
    logger.log('info', `User created successfully: ${username}`);
    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        accountId: newUser.accountId,
        isAdmin: newUser.isAdmin,
      },
    });
  } catch (error) {
    logger.log('error', `Error creating user: ${error.message}`);
    return res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
});

router.delete('/delete-user/:id', adminMiddleware, async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await db.User.destroy({
      where: { id: userId }
    });
    if (result === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    logger.log('info', `User deleted successfully: ID ${userId}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    logger.log('error', `Error deleting user: ${error.message}`);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

router.put('/update-user/:id', adminMiddleware, async (req, res) => {
  const userId = req.params.id;
  const { username, password } = req.body;

  try {
    if (!username && !password) {
      return res.status(400).json({ message: 'At least one field (username or password) is required' });
    }

    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    await user.update(updateData);
    logger.log('info', `User updated successfully: ID ${userId}, username ${username}`);
    res.json({ message: 'User updated successfully', user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Error updating user:', error);
    logger.log('error', `Error updating user: ${error.message}`);
    res.status(500).json({ message: 'Error updating user' });
  }
});

router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await db.User.findAll({
      attributes: ['id', 'username', 'password'],
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

module.exports = router;