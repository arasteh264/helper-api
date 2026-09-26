import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PasswordHasher } from '../../domain/services/password-hasher.port';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
