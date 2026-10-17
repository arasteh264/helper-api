import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  it.each([undefined, '', '   '])(
    'accepts an omitted or blank optional email (%s)',
    async (email) => {
      const dto = plainToInstance(CreateUserDto, {
        name: 'Test User',
        phone: '09121234567',
        password: 'StrongPass123',
        ...(email === undefined ? {} : { email }),
      });

      expect(dto.email).toBeUndefined();
      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects an invalid non-empty email', async () => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Test User',
      phone: '09121234567',
      password: 'StrongPass123',
      email: 'not-an-email',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'email' }),
      ]),
    );
  });
});
