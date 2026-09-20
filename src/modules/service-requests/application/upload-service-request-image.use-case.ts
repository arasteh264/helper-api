import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { ServiceRequestRepository } from '../domain/repositories/service-request.repository';
import { SERVICE_REQUEST_REPOSITORY } from '../domain/repositories/service-request.repository.token';
import { IMAGE_UPLOADER } from '../../../shared/storage/image-uploader.token';
import type { ImageUploader } from '../../../shared/storage/image-uploader.port';

@Injectable()
export class UploadServiceRequestImageUseCase {
  constructor(
    @Inject(SERVICE_REQUEST_REPOSITORY)
    private readonly serviceRequestRepository: ServiceRequestRepository,
    @Inject(IMAGE_UPLOADER)
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(
    requestId: string,
    currentUserId: string,
    fileBuffer: Buffer,
  ): Promise<{ url: string }> {
    const request = await this.serviceRequestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== currentUserId) {
      throw new ForbiddenException('You can only upload images to your own requests');
    }

    const uploaded = await this.imageUploader.upload(
      fileBuffer,
      `service-requests/${requestId}`,
    );

    await this.serviceRequestRepository.addImage(
      requestId,
      uploaded.url,
      uploaded.publicId,
    );

    return { url: uploaded.url };
  }
}