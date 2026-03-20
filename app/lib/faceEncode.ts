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

  try {
    const { data } = await request();
    if (!data.success || !data.data?.descriptor?.length) {
      throw new Error(data.message ?? 'Could not encode face.');
    }
    return data.data.descriptor;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 502 || status === 503 || status === 504) {
      // Render cold starts can briefly return gateway/service-unavailable; retry once.
      await new Promise((r) => setTimeout(r, 1800));
      const { data } = await request();
      if (!data.success || !data.data?.descriptor?.length) {
        throw new Error(data.message ?? 'Could not encode face.');
      }
      return data.data.descriptor;
    }
    throw err;
  }
}
