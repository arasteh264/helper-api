import { PaginatedResult } from '../../../../shared/types/paginated-result.type';
import { User } from '../entities/user.entity';

export interface UserRepository {
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByResetToken(token: string): Promise<User | null>;
  findAll(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<PaginatedResult<User>>;
}