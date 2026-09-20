import { Inject, Injectable } from '@nestjs/common';

import { User } from '../domain/entities/user.entity';
import type { UserRepository } from '../domain/repositories/user.repository';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';
import { PaginatedResult } from '../../../shared/types/paginated-result.type';

@Injectable()
export class GetAllUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

async execute(query: PaginationQueryDto): Promise<PaginatedResult<User>> {
  return this.userRepository.findAll({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
    search: query.search,
  });
}
}