import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Max } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';

export class AdminPendingProvidersQueryDto extends PaginationQueryDto {
  @Max(100)
  declare pageSize?: number;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  available?: 'true' | 'false';
}
