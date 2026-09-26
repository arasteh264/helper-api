import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import {
  ImageUploader,
  UploadedImage,
} from '../../../../shared/storage/image-uploader.port';

@Injectable()
export class CloudinaryImageUploader implements ImageUploader {
  private readonly logger = new Logger(CloudinaryImageUploader.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(fileBuffer: Buffer, folder: string): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Upload failed', error);
            return reject(error);
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(fileBuffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
