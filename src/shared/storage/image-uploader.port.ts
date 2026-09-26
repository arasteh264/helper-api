export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface ImageUploader {
  upload(fileBuffer: Buffer, folder: string): Promise<UploadedImage>;
  delete(publicId: string): Promise<void>;
}
