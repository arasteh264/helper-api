import { Global, Module } from '@nestjs/common';
import { IMAGE_UPLOADER } from './image-uploader.token';
import { CloudinaryImageUploader } from './cloudinary-image-uploader';

@Global()
@Module({
  providers: [
    {
      provide: IMAGE_UPLOADER,
      useClass: CloudinaryImageUploader,
    },
  ],
  exports: [IMAGE_UPLOADER],
})
export class StorageModule {}
