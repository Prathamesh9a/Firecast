const axios = require('axios');

const crypto = require('crypto');

// Encrypted value generated using the same algorithm and secret key
const encryptedLimit = 'e7ZLZFFrXSiP/1U2FOvj4w=='; // Replace with your actual encrypted value
const secretKey = '9ATicker'; // Use the same key that was used for encryption

function decrypt(encrypted, secretKey) {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', secretKey);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return parseInt(decrypted, 10); // Convert the decrypted value to an integer
  } catch (error) {
    console.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt the MAX_URL_LIMIT');
  }
}

// Decrypt the MAX_URL_LIMIT value
const MAX_URL_LIMIT = decrypt(encryptedLimit, secretKey);



const authenticate = async (req, res, next) => {
  try {
    console.log('Maximum URL limit:', MAX_URL_LIMIT);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized: Invalid token', error: error.message });
  }
};

module.exports = {authenticate,
  decrypt
}
