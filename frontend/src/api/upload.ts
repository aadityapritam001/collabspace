/**
 * File-upload helper — matches Emergent Object Storage playbook.
 * Uses expo-image-picker + fetch multipart (native shape on device, Blob on web).
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getBaseUrl, loadToken } from './client';

export async function pickImageAndUpload(): Promise<{ path: string; url: string; file_token: string } | null> {
  // Request permission on device (web ignores it).
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  const form = new FormData();
  const fileName = asset.fileName || `upload_${Date.now()}.jpg`;
  const type = asset.mimeType || 'image/jpeg';

  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    form.append('file', blob, fileName);
  } else {
    // React Native native FormData shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.append('file', { uri: asset.uri, name: fileName, type } as any);
  }

  const token = await loadToken();
  const res = await fetch(`${getBaseUrl()}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `Upload failed (${res.status})`);
  }
  return res.json();
}

/**
 * Build a fully-qualified URL for a stored file.
 * On web we append the short-lived token so <img> tags can read authed files.
 */
export function fileUrl(path: string, token?: string): string {
  const url = `${getBaseUrl()}/api/files/${path}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
