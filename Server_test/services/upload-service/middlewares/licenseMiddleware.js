const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Use a dynamic, relative path so it works in executable environments
const licensePath = path.join(process.cwd(), 'config', 'license.enc'); // Place this file near the .exe
const encryptionKey = 'TickerApplication9AWelcome@9049A'; // You may also load this from env
const algorithm = 'aes-256-cbc';

function decrypt(text, key) {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(text.iv, 'hex'));
  let decrypted = decipher.update(Buffer.from(text.encryptedData, 'hex'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const licenseMiddleware = (req, res, next) => {
  try {
    // Read and decrypt the license file
    const encryptedLicense = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
    const licenseData = JSON.parse(decrypt(encryptedLicense, encryptionKey));
    // console.log(licenseData, "licenseData");

    const { expirationDate } = licenseData;

    // Check if the license is expired
    const currentDate = new Date();
    if (new Date(expirationDate) < currentDate) {
      console.log("License has expired.");
      return res.status(403).json({
        message: 'Your license has expired. Please contact the administrator.',
      });
    }

    // License is valid, proceed to the next middleware or route
    next();
  } catch (error) {
    console.error('Error in license validation:', error);
    return res.status(500).json({
      message: 'License validation failed. Please contact the administrator.',
    });
  }
};

module.exports = licenseMiddleware;
