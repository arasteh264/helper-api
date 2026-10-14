export interface UploadedImage {
  url: string;
  publicId: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  bytes?: number;
}

export interface SignedMediaUpload {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  timestamp: number;
  publicId: string;
  signature: string;
  resourceType: 'image' | 'video';
}

export interface ImageUploader {
  upload(
    fileBuffer: Buffer,
    folder: string,
    resourceType?: 'image' | 'video',
  ): Promise<UploadedImage>;
  delete(publicId: string, resourceType?: 'image' | 'video'): Promise<void>;
}

export interface StoryMediaUploader extends ImageUploader {
  createSignedUpload(
    folder: string,
    publicId: string,
    resourceType: 'image' | 'video',
  ): SignedMediaUpload;
  getUploaded(
    publicId: string,
    resourceType: 'image' | 'video',
  ): Promise<UploadedImage>;
}
