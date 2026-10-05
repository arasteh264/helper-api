import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Max } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';

export class MyServiceRequestsQueryDto extends PaginationQueryDto {
  @Max(100)
  declare pageSize?: number;

  @ApiPropertyOptional({ enum: ['active', 'completed', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'completed', 'cancelled'])
  group?: 'active' | 'completed' | 'cancelled' = 'active';
}
