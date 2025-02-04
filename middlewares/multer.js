const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png/;
  const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = fileTypes.test(file.mimetype);
  cb(null, extName && mimeType ? true : new Error('Only images are allowed!'));
};

const multerUpload = (fieldName, limit = 1, isArray = false) => {
  return multer({ storage, fileFilter })[isArray ? 'array' : 'single'](fieldName, limit);
};

module.exports = { multerUpload };