import { File, Paths, Directory } from 'expo-file-system';

const PHOTOS_DIR_NAME = 'meal_photos';

const getPhotosDir = (): Directory => {
  const dir = new Directory(Paths.document, PHOTOS_DIR_NAME);
  if (!dir.exists) dir.create();
  return dir;
};

export const savePhoto = async (tempUri: string): Promise<string> => {
  try {
    const dir = getPhotosDir();
    const fileName = `meal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
    const tempFile = new File(tempUri);
    const destFile = new File(dir, fileName);

    // Read temp file and write to permanent location
    const buffer = await tempFile.arrayBuffer();
    destFile.create();
    destFile.write(new Uint8Array(buffer));

    return destFile.uri;
  } catch {
    // If copy fails, return original URI as fallback
    return tempUri;
  }
};
