const express = require('express');
const multer = require('multer');
const { uploadProductImage } = require('../controllers/uploadController');
const { requireAdmin } = require('../middleware/adminMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      cb(new AppError(400, 'Only image files are allowed'));
      return;
    }
    cb(null, true);
  }
});

function handleSingleImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'Image must be 5MB or smaller'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

router.post('/upload-image', requireAdmin, handleSingleImage, asyncHandler(uploadProductImage));

module.exports = router;
