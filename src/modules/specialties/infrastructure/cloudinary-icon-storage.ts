import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IMAGE_UPLOADER } from '../../../shared/storage/image-uploader.token';
import type { ImageUploader } from '../../../shared/storage/image-uploader.port';
import type {
  IIconStorage,
  StoredIcon,
} from '../domain/services/icon-storage.port';

@Injectable()
export class CloudinaryIconStorage implements IIconStorage {
  constructor(
    @Inject(IMAGE_UPLOADER) private readonly imageUploader: ImageUploader,
  ) {}

  uploadIcon(file: Express.Multer.File, folder: string): Promise<StoredIcon> {
    if (!file?.buffer?.length || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('فایل آیکون معتبر نیست');
    }

    return this.imageUploader.upload(file.buffer, folder);
  }

  deleteIcon(publicId: string): Promise<void> {
    return this.imageUploader.delete(publicId);
  }
}
