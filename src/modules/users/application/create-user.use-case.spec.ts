jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TokenGenerator } from '../../auth/domain/services/token-generator.port';
import { User } from '../domain/entities/user.entity';
import { UserRepository } from '../domain/repositories/user.repository';
import { PasswordHasher } from '../domain/services/password-hasher.port';
import { OtpSender } from '../../auth/domain/services/otp-sender.port';
import { CreateUserUseCase } from './create-user.use-case';

describe('CreateUserUseCase', () => {
  const originalRequireOtp = process.env.REQUIRE_REGISTRATION_OTP;
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<
    Pick<UserRepository, 'findByEmail' | 'findByPhone' | 'save'>
  >;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let otpSender: jest.Mocked<OtpSender>;
  let tokenGenerator: jest.Mocked<TokenGenerator>;
  let pendingRegistration: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };

  beforeEach(() => {
    delete process.env.REQUIRE_REGISTRATION_OTP;
    userRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findByPhone: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      compare: jest.fn().mockResolvedValue(true),
    };
    otpSender = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    tokenGenerator = {
      generate: jest.fn().mockReturnValue('test-access-token'),
    };
    pendingRegistration = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };

    useCase = new CreateUserUseCase(
      userRepository as unknown as UserRepository,
      passwordHasher,
      otpSender,
      { pendingRegistration } as unknown as PrismaService,
      tokenGenerator,
    );
  });

  afterAll(() => {
    if (originalRequireOtp === undefined) {
      delete process.env.REQUIRE_REGISTRATION_OTP;
    } else {
      process.env.REQUIRE_REGISTRATION_OTP = originalRequireOtp;
    }
  });

  const input = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '09121234567',
    password: 'StrongPass123',
  };

  it('creates an active account without OTP by default', async () => {
    const result = await useCase.execute(input);

    expect(result).toEqual({
      registrationCompleted: true,
      accessToken: 'test-access-token',
    });
    const [user] = userRepository.save.mock.calls[0];
    expect(user).toBeInstanceOf(User);
    expect(user.status).toBe('ACTIVE');
    expect(otpSender.send).not.toHaveBeenCalled();
    expect(pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { phone: input.phone },
    });
  });

  it('requires OTP only when explicitly enabled', async () => {
    process.env.REQUIRE_REGISTRATION_OTP = 'true';

    const result = await useCase.execute(input);

    expect(result).toEqual({ registrationCompleted: false });
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(pendingRegistration.upsert).toHaveBeenCalled();
    expect(otpSender.send).toHaveBeenCalledWith(
      input.phone,
      expect.any(String),
      90,
    );
  });

  it('allows registration without email and sends the OTP to the phone', async () => {
    process.env.REQUIRE_REGISTRATION_OTP = 'true';

    const inputWithoutEmail = {
      name: input.name,
      phone: input.phone,
      password: input.password,
    };
    const result = await useCase.execute(inputWithoutEmail);

    expect(result).toEqual({ registrationCompleted: false });
    expect(pendingRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: input.phone },
        create: expect.objectContaining({
          email: `${input.phone}@placeholder.local`,
        }),
      }),
    );
    expect(otpSender.send).toHaveBeenCalledWith(
      input.phone,
      expect.any(String),
      90,
    );
  });
});
