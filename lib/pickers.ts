// File pickers for profile photos and event posters. They return a PickedFile, or null if canceled.
// Must be called from a button press (browsers only open file dialogs on user action).

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from './types';

export async function pickProfilePhoto(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // square crop
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'avatar.jpg' };
}

// Poster: a PDF or an image
export async function pickPoster(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    base64: false, // web: we only need the blob URL
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) {
    throw new Error('La locandina deve essere un PDF o un’immagine');
  }
  return { uri: asset.uri, mimeType, name: asset.name };
}

export const isPdf = (mime: string | null | undefined) => mime === 'application/pdf';
