import { ForbiddenException } from '@nestjs/common';
import { ProviderProfile } from '../../domain/entities/provider-profile.entity';
import { UpdateProviderProfileUseCase } from './update-provider-profile.use-case';

describe('UpdateProviderProfileUseCase', () => {
  it('does not allow an unapproved provider to become available', async () => {
    const profile = ProviderProfile.create('provider-user', null);
    const repository = {
      findByUserId: jest.fn().mockResolvedValue(profile),
      update: jest.fn(),
      findDetailsByUserId: jest.fn(),
    };
    const useCase = new UpdateProviderProfileUseCase(repository as never);

    await expect(
      useCase.execute('provider-user', { isAvailable: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
