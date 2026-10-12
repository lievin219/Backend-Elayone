import { RequestHandler } from 'express';
import multer from 'multer';

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Only MP3 and MP4 media files are supported.'));
  },
});
export const uploadMedia: RequestHandler = (request, response, next) => {
  mediaUpload.single('media')(request, response, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ message: 'The media file is too large. Maximum size is 100 MB.' });
    if (error) return response.status(400).json({ message: error.message });
    return next();
  });
};
