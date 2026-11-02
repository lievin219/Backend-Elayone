"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SongMediaConfigurationError = void 0;
exports.uploadSongMedia = uploadSongMedia;
exports.createSongUpload = createSongUpload;
exports.removeSongMedia = removeSongMedia;
exports.getPlayableSongUrl = getPlayableSongUrl;
exports.getSongMediaPath = getSongMediaPath;
const supabase_js_1 = require("@supabase/supabase-js");
const node_crypto_1 = require("node:crypto");
function getBucketName() {
    return process.env.SUPABASE_SONGS_BUCKET || 'song-media';
}
const extensions = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'video/mp4': 'mp4',
    'audio/mp4': 'mp4',
};
let client;
class SongMediaConfigurationError extends Error {
}
exports.SongMediaConfigurationError = SongMediaConfigurationError;
function getStorageClient() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (!url || !serviceRoleKey) {
        throw new SongMediaConfigurationError('Song uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) on the API server.');
    }
    client ??= (0, supabase_js_1.createClient)(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return client.storage.from(getBucketName());
}
async function uploadSongMedia(file) {
    const extension = extensions[file.mimetype];
    if (!extension)
        throw new Error('Only MP3 and MP4 media files are supported.');
    const storage = getStorageClient();
    const path = `songs/${(0, node_crypto_1.randomUUID)()}.${extension}`;
    const { error } = await storage.upload(path, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
    });
    if (error)
        throw new Error(`Could not upload song media to Supabase Storage: ${error.message}`);
    return {
        path,
        publicUrl: storage.getPublicUrl(path).data.publicUrl,
    };
}
async function createSongUpload(mimeType, fileName) {
    const extension = extensions[mimeType];
    if (!extension)
        throw new Error('Only MP3 and MP4 media files are supported.');
    if (!fileName.trim())
        throw new Error('A file name is required.');
    const storage = getStorageClient();
    const path = `songs/${(0, node_crypto_1.randomUUID)()}.${extension}`;
    const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
    if (error || !data)
        throw new Error(`Could not prepare the song upload: ${error?.message ?? 'No signed upload URL was returned.'}`);
    return {
        path,
        signedUrl: data.signedUrl,
        publicUrl: storage.getPublicUrl(path).data.publicUrl,
    };
}
async function removeSongMedia(path) {
    const { error } = await getStorageClient().remove([path]);
    if (error)
        throw new Error(`Could not remove song media from Supabase Storage: ${error.message}`);
}
async function getPlayableSongUrl(previewUrl) {
    if (!previewUrl)
        return null;
    const path = getSongMediaPath(previewUrl);
    if (!path)
        return previewUrl;
    const { data, error } = await getStorageClient().createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
        throw new Error(`Could not create a playback link for uploaded song media: ${error?.message ?? 'No signed URL was returned.'}`);
    }
    return data.signedUrl;
}
function getSongMediaPath(publicUrl) {
    const url = process.env.SUPABASE_URL;
    if (!url)
        return null;
    const prefix = `${url.replace(/\/$/, '')}/storage/v1/object/public/${getBucketName()}/`;
    if (!publicUrl.startsWith(prefix))
        return null;
    try {
        const path = decodeURIComponent(publicUrl.slice(prefix.length));
        if (!path.startsWith('songs/') || path.includes('..'))
            return null;
        return path;
    }
    catch {
        return null;
    }
}
