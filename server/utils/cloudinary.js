const { v2: cloudinary } = require('cloudinary');
const AppError = require('./AppError');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function ensureCloudinaryConfig() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new AppError(500, 'Cloudinary is not configured');
  }
}

function uploadImageBuffer(buffer) {
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'nehal-express/products',
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(new AppError(502, 'Image upload failed'));
          return;
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

module.exports = {
  uploadImageBuffer
};
