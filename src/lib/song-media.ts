import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const bucket = process.env.SUPABASE_SONGS_BUCKET || 'song-media';
const extensions: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'video/mp4': 'mp4',
  'audio/mp4': 'mp4',
};

let client: SupabaseClient | undefined;

export class SongMediaConfigurationError extends Error {}

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new SongMediaConfigurationError(
      'Song uploads are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server.',
    );
  }
  client ??= createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client.storage.from(bucket);
}

export async function uploadSongMedia(file: { buffer: Buffer; mimetype: string }) {
  const extension = extensions[file.mimetype];
  if (!extension) throw new Error('Only MP3 and MP4 media files are supported.');

  const storage = getStorageClient();
  const path = `songs/${randomUUID()}.${extension}`;
  const { error } = await storage.upload(path, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`Could not upload song media to Supabase Storage: ${error.message}`);

  return {
    path,
    publicUrl: storage.getPublicUrl(path).data.publicUrl,
  };
}

export async function removeSongMedia(path: string) {
  const { error } = await getStorageClient().remove([path]);
  if (error) throw new Error(`Could not remove song media from Supabase Storage: ${error.message}`);
}

export function getSongMediaPath(publicUrl: string) {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  const prefix = `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`;
  if (!publicUrl.startsWith(prefix)) return null;

  const path = decodeURIComponent(publicUrl.slice(prefix.length));
  if (!path.startsWith('songs/') || path.includes('..')) return null;
  return path;
}
