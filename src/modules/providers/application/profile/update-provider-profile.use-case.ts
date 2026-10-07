import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { ProviderPrivateProfileDetailsResponseDto } from '../dto/provider-private-profile-details-response.dto';


@Injectable()
export class UpdateProviderProfileUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(
    userId: string,
    dto: {
      bio?: string;
      isAvailable?: boolean;
      serviceAreaLatitude?: number | null;
      serviceAreaLongitude?: number | null;
      serviceAreaRadiusKm?: number;
      providerAddress?: string;
      providerAddressType?: 'HOME' | 'BUSINESS';
    },
  ) {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    if (
      dto.isAvailable === true &&
      !profile.providerAddress?.trim()
    ) {
      throw new BadRequestException(
        'برای دریافت درخواست، ابتدا نشانی محرمانه‌ی منزل یا محل کسب را ثبت کنید',
      );
    }

    if (dto.bio !== undefined) profile.updateBio(dto.bio);
    if (dto.isAvailable !== undefined) profile.setAvailability(dto.isAvailable);
    if (
      dto.serviceAreaLatitude !== undefined ||
      dto.serviceAreaLongitude !== undefined ||
      dto.serviceAreaRadiusKm !== undefined
    ) {
      profile.setServiceArea(
        dto.serviceAreaLatitude ?? profile.serviceAreaLatitude,
        dto.serviceAreaLongitude ?? profile.serviceAreaLongitude,
        dto.serviceAreaRadiusKm ?? profile.serviceAreaRadiusKm,
      );
    }
    if (
      dto.providerAddress !== undefined ||
      dto.providerAddressType !== undefined
    ) {
      profile.setProviderAddress(
        dto.providerAddress === undefined
          ? profile.providerAddress
          : dto.providerAddress.trim(),
        dto.providerAddressType ?? profile.providerAddressType,
      );
    }
    await this.providerProfileRepository.update(profile);

    const details =
      await this.providerProfileRepository.findDetailsByUserId(userId);
    return ProviderPrivateProfileDetailsResponseDto.from(details!);
  }
}
