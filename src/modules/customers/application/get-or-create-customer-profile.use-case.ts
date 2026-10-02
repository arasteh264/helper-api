import { Inject, Injectable } from '@nestjs/common';
import { CustomerProfile } from '../domain/entities/customer-profile.entity';
import { CUSTOMER_PROFILE_REPOSITORY } from '../domain/repositories/customer-profile.repository.token';
import type { CustomerProfileRepository } from '../domain/repositories/customer-profile.repository';

@Injectable()
export class GetOrCreateCustomerProfileUseCase {
  constructor(
    @Inject(CUSTOMER_PROFILE_REPOSITORY)
    private readonly repository: CustomerProfileRepository,
  ) {}

  async execute(userId: string): Promise<CustomerProfile> {
    const existing = await this.repository.findByUserId(userId);
    if (existing) return existing;

    await this.repository.save(CustomerProfile.create(userId));
    return (await this.repository.findByUserId(userId))!;
  }
}