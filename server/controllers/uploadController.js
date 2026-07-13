const { uploadImageBuffer } = require('../utils/cloudinary');
const AppError = require('../utils/AppError');

async function uploadProductImage(req, res) {
  if (!req.file) {
    throw new AppError(400, 'Please choose an image file to upload');
  }

  const result = await uploadImageBuffer(req.file.buffer);
  res.status(201).json({
    secure_url: result.secure_url,
    public_id: result.public_id
  });
}

module.exports = {
  uploadProductImage
};
