// import { ConflictException } from '@nestjs/common';
// import { CreateUserUseCase } from '@/modules/users/application/create-user.use-case';
// import { User } from '@/modules/users/domain/entities/user.entity';
// import { UserRepository } from '@/modules/users/domain/repositories/user.repository';
// import { PasswordHasher } from '@/modules/users/domain/services/password-hasher.port';

// function buildInput(overrides: Partial<{
//   name: string;
//   email: string;
//   phone: string;
//   password: string;
// }> = {}) {
//   return {
//     name: 'John Doe',
//     email: 'john@example.com',
//     phone: '09123456789',
//     password: '123456',
//     ...overrides,
//   };
// }

// function buildExistingUser(overrides: Partial<{
//   name: string;
//   email: string;
//   phone: string;
//   passwordHash: string;
// }> = {}) {
//   const { name, email, phone, passwordHash } = {
//     name: 'Existing User',
//     email: 'existing@example.com',
//     phone: '09111111111',
//     passwordHash: 'hashed-password',
//     ...overrides,
//   };

//   return User.create(name, email, phone, passwordHash);
// }

// function createMockUserRepository(): jest.Mocked<UserRepository> {
//   return {
//     save: jest.fn(),
//     update: jest.fn(),
//     findById: jest.fn(),
//     findByEmail: jest.fn(),
//     findByPhone: jest.fn(),
//     findByResetToken: jest.fn(),
//     findAll: jest.fn(),
//   };
// }

// function createMockPasswordHasher(): jest.Mocked<PasswordHasher> {
//   return {
//     hash: jest.fn(),
//     compare: jest.fn(),
//   };
// }


// describe('CreateUserUseCase', () => {
//   let useCase: CreateUserUseCase;
//   let userRepository: jest.Mocked<UserRepository>;
//   let passwordHasher: jest.Mocked<PasswordHasher>;

//   beforeEach(() => {
//     userRepository = createMockUserRepository();
//     passwordHasher = createMockPasswordHasher();
//     useCase = new CreateUserUseCase(userRepository, passwordHasher);

//     userRepository.findByEmail.mockResolvedValue(null);
//     userRepository.findByPhone.mockResolvedValue(null);
//     passwordHasher.hash.mockResolvedValue('hashed-password');
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   });

//   describe('when the input is valid and unique', () => {
//     it('creates a User instance populated with the given data', async () => {
//       const input = buildInput();

//       const result = await useCase.execute(input);

//       expect(result).toBeInstanceOf(User);
//       expect(result.name).toBe(input.name);
//       expect(result.email).toBe(input.email);
//       expect(result.phone).toBe(input.phone);
//     });

//     it('hashes the plain-text password before storing it', async () => {
//       const input = buildInput({ password: 'plain-password' });

//       const result = await useCase.execute(input);

//       expect(passwordHasher.hash).toHaveBeenCalledWith(input.password);
//       expect(result.passwordHash).toBe('hashed-password');
//       expect(result.passwordHash).not.toBe(input.password);
//     });

//     it('checks for existing users by email and phone before creating', async () => {
//       const input = buildInput();

//       await useCase.execute(input);

//       expect(userRepository.findByEmail).toHaveBeenCalledWith(input.email);
//       expect(userRepository.findByPhone).toHaveBeenCalledWith(input.phone);
//     });

//     it('persists exactly one user through the repository', async () => {
//       const input = buildInput();

//       const result = await useCase.execute(input);

//       expect(userRepository.save).toHaveBeenCalledTimes(1);
//       expect(userRepository.save).toHaveBeenCalledWith(result);
//     });
//   });

//   describe('when the email is already taken', () => {
//     beforeEach(() => {
//       userRepository.findByEmail.mockResolvedValue(buildExistingUser());
//     });

//     it('throws a ConflictException', async () => {
//       const input = buildInput();

//       await expect(useCase.execute(input)).rejects.toThrow(
//         new ConflictException('User with this email already exists'),
//       );
//     });

//     it('does not check the phone, hash the password, or save anything', async () => {
//       const input = buildInput();

//       await expect(useCase.execute(input)).rejects.toThrow(ConflictException);

//       expect(userRepository.findByPhone).not.toHaveBeenCalled();
//       expect(passwordHasher.hash).not.toHaveBeenCalled();
//       expect(userRepository.save).not.toHaveBeenCalled();
//     });
//   });

//   describe('when the phone is already taken', () => {
//     beforeEach(() => {
//       userRepository.findByPhone.mockResolvedValue(buildExistingUser());
//     });

//     it('throws a ConflictException', async () => {
//       const input = buildInput();

//       await expect(useCase.execute(input)).rejects.toThrow(
//         new ConflictException('User with this phone already exists'),
//       );
//     });

//     it('does not hash the password or save anything', async () => {
//       const input = buildInput();

//       await expect(useCase.execute(input)).rejects.toThrow(ConflictException);

//       expect(passwordHasher.hash).not.toHaveBeenCalled();
//       expect(userRepository.save).not.toHaveBeenCalled();
//     });
//   });
// });