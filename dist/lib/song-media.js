"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SongMediaConfigurationError = void 0;
exports.uploadSongMedia = uploadSongMedia;
exports.removeSongMedia = removeSongMedia;
exports.getSongMediaPath = getSongMediaPath;
const supabase_js_1 = require("@supabase/supabase-js");
const node_crypto_1 = require("node:crypto");
const bucket = process.env.SUPABASE_SONGS_BUCKET || 'song-media';
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
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
        throw new SongMediaConfigurationError('Song uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server.');
    }
    client ??= (0, supabase_js_1.createClient)(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return client.storage.from(bucket);
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
async function removeSongMedia(path) {
    const { error } = await getStorageClient().remove([path]);
    if (error)
        throw new Error(`Could not remove song media from Supabase Storage: ${error.message}`);
}
function getSongMediaPath(publicUrl) {
    const url = process.env.SUPABASE_URL;
    if (!url)
        return null;
    const prefix = `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`;
    if (!publicUrl.startsWith(prefix))
        return null;
    const path = decodeURIComponent(publicUrl.slice(prefix.length));
    if (!path.startsWith('songs/') || path.includes('..'))
        return null;
    return path;
}
