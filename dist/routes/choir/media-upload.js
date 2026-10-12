"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMedia = void 0;
const multer_1 = __importDefault(require("multer"));
const mediaUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
        if (['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(file.mimetype)) {
            callback(null, true);
            return;
        }
        callback(new Error('Only MP3 and MP4 media files are supported.'));
    },
});
const uploadMedia = (request, response, next) => {
    mediaUpload.single('media')(request, response, (error) => {
        if (error instanceof multer_1.default.MulterError && error.code === 'LIMIT_FILE_SIZE')
            return response.status(413).json({ message: 'The media file is too large. Maximum size is 100 MB.' });
        if (error)
            return response.status(400).json({ message: error.message });
        return next();
    });
};
exports.uploadMedia = uploadMedia;
