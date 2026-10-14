import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import type { StoryMediaUploader, UploadedImage } from './image-uploader.port';

interface CloudinaryResource {
  public_id: string;
  secure_url: string;
  bytes: number;
  duration?: number;
}

function isCloudinaryResource(value: unknown): value is CloudinaryResource {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'public_id' in value &&
    typeof value.public_id === 'string' &&
    'secure_url' in value &&
    typeof value.secure_url === 'string' &&
    'bytes' in value &&
    typeof value.bytes === 'number' &&
    (!('duration' in value) || typeof value.duration === 'number')
  );
}

@Injectable()
export class CloudinaryImageUploader implements StoryMediaUploader {
  private readonly logger = new Logger(CloudinaryImageUploader.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      upload_prefix: process.env.CLOUDINARY_UPLOAD_PREFIX,
    });
  }

  async upload(
    fileBuffer: Buffer,
    folder: string,
    resourceType: 'image' | 'video' = 'image',
  ): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const handleUpload = (
        error?: UploadApiErrorResponse,
        result?: UploadApiResponse,
      ) => {
        if (error || !result) {
          this.logger.error('Upload failed', error?.message);
          return reject(
            new Error(error?.message ?? 'Upload returned no media result'),
          );
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          durationSeconds:
            typeof result.duration === 'number' ? result.duration : undefined,
          thumbnailUrl:
            resourceType === 'video'
              ? cloudinary.url(result.public_id, {
                  resource_type: 'video',
                  format: 'jpg',
                  secure: true,
                  transformation: [
                    { start_offset: '0' },
                    { width: 640, crop: 'limit' },
                  ],
                })
              : undefined,
        });
      };
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        handleUpload,
      );
      stream.end(fileBuffer);
    });
  }

  createSignedUpload(
    folder: string,
    publicId: string,
    resourceType: 'image' | 'video',
  ) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPrefix = process.env.CLOUDINARY_UPLOAD_PREFIX?.trim();
    if (!cloudName || !apiKey || !apiSecret || !uploadPrefix) {
      throw new Error(
        'Cloudinary credentials and CLOUDINARY_UPLOAD_PREFIX must be configured',
      );
    }
    let parsedUploadPrefix: URL;
    try {
      parsedUploadPrefix = new URL(uploadPrefix);
    } catch {
      throw new Error('CLOUDINARY_UPLOAD_PREFIX must be a valid URL');
    }
    if (parsedUploadPrefix.protocol !== 'https:') {
      throw new Error('CLOUDINARY_UPLOAD_PREFIX must use HTTPS');
    }
    cloudinary.config({ upload_prefix: uploadPrefix.replace(/\/+$/, '') });
    const timestamp = Math.floor(Date.now() / 1000);
    const fullPublicId = `${folder}/${publicId}`;
    const params = {
      public_id: fullPublicId,
      timestamp,
      overwrite: false,
    };
    return {
      cloudName,
      apiKey,
      uploadUrl: cloudinary.utils.api_url('upload', {
        resource_type: resourceType,
      }),
      timestamp,
      publicId: fullPublicId,
      signature: cloudinary.utils.api_sign_request(params, apiSecret),
      resourceType,
    };
  }

  async getUploaded(
    publicId: string,
    resourceType: 'image' | 'video',
  ): Promise<UploadedImage> {
    const resource: unknown = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    if (!isCloudinaryResource(resource) || resource.public_id !== publicId) {
      throw new Error(
        'Cloudinary did not return valid uploaded media metadata',
      );
    }
    return {
      url: resource.secure_url,
      publicId: resource.public_id,
      bytes: resource.bytes,
      durationSeconds: resource.duration,
      thumbnailUrl:
        resourceType === 'video'
          ? cloudinary.url(resource.public_id, {
              resource_type: 'video',
              format: 'jpg',
              secure: true,
              transformation: [
                { start_offset: '0' },
                { width: 640, crop: 'limit' },
              ],
            })
          : undefined,
    };
  }

  async delete(
    publicId: string,
    resourceType: 'image' | 'video' = 'image',
  ): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
