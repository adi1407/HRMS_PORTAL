import axios from 'axios';
import { API_URL } from '@/config/env';
import { useAuthStore } from '@/store/authStore';

/**
 * Upload a JPEG from the device camera; server runs the same face-api.js pipeline as the web app.
 */
export async function encodeFaceDescriptorFromUri(uri: string): Promise<number[]> {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append('image', {
    uri,
    type: 'image/jpeg',
    name: 'face.jpg',
  } as unknown as Blob);

  const request = () =>
    axios.post<{ success: boolean; data?: { descriptor: number[] }; message?: string }>(`${API_URL}/face/encode`, form, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'X-Client': 'mobile',
      },
      timeout: 120000,
    });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const retryable = new Set([502, 503, 504]);
  const delays = [0, 2000, 4000, 7000];

  let lastErr: unknown = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    try {
      const { data } = await request();
      if (!data.success || !data.data?.descriptor?.length) {
        throw new Error(data.message ?? 'Could not encode face.');
      }
      return data.data.descriptor;
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (!retryable.has(status ?? 0)) throw err;
    }
  }
  const status = (lastErr as { response?: { status?: number } })?.response?.status;
  if (retryable.has(status ?? 0)) {
    throw new Error('Face service is temporarily unavailable (503). Please use web face check-in/enrollment for now.');
  }
  throw lastErr;
}
