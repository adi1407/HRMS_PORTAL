import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  const pad = bytes.length % 3;
  if (pad === 1) return out.slice(0, -2) + '==';
  if (pad === 2) return out.slice(0, -1) + '=';
  return out;
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { message?: string };
      return data?.message || `Request failed (${res.status})`;
    }
    const text = await res.text();
    return text || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

type DownloadArgs = {
  path: string; // path starting with /... against API baseURL
  fileName: string; // include extension
  mimeType: string;
  dialogTitle?: string;
  extraHeaders?: Record<string, string>;
};

function resolveWritableDirectory(): string | null {
  // Prefer cache for temporary exports; fall back to documents when cache is unavailable.
  const cacheDir = (FileSystem as unknown as { cacheDirectory?: string | null }).cacheDirectory ?? null;
  if (cacheDir) return cacheDir;
  const docDir = (FileSystem as unknown as { documentDirectory?: string | null }).documentDirectory ?? null;
  if (docDir) return docDir;
  return null;
}

export async function downloadAndShareFromApi({
  path,
  fileName,
  mimeType,
  dialogTitle,
  extraHeaders,
}: DownloadArgs): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('You are not authenticated. Please sign in again.');

  const baseURL = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  if (!baseURL) throw new Error('API base URL is not configured.');

  const url = `${baseURL}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Client': 'mobile',
      ...(extraHeaders || {}),
    },
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message);
  }

  const arrayBuffer = await res.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const base64 = uint8ArrayToBase64(uint8);
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const writableDir = resolveWritableDirectory();

  if (writableDir) {
    const fileUri = `${writableDir}${safeName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: dialogTitle || fileName });
      return;
    }
  }

  // Fallback for runtimes where FileSystem directories are unavailable.
  try {
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const result = await Share.share({ url: dataUrl, title: dialogTitle || fileName, message: fileName });
    if (!result.action) {
      throw new Error('Share failed');
    }
  } catch {
    throw new Error('Could not access app storage for file export on this runtime.');
  }
}

