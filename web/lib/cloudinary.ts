import { v2 as cloudinary } from 'cloudinary';

// Product-image uploads (admin dashboard) go to Cloudinary. Only the signing
// happens server-side; the browser uploads the file bytes directly.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
