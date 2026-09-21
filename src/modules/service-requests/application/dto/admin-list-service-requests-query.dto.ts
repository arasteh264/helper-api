import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { ServiceRequestStatus } from '../../domain/entities/service-request-status.enum';
import { PreferredTime } from '../../domain/entities/preferred-time.enum';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';

export const SERVICE_REQUEST_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'budgetMin',
  'budgetMax',
] as const;

export class AdminListServiceRequestsQueryDto extends PaginationQueryDto {
  @Max(100)
  declare pageSize?: number;

  @ApiPropertyOptional({ enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: PreferredTime })
  @IsOptional()
  @IsEnum(PreferredTime)
  preferredTime?: PreferredTime;

  @ApiPropertyOptional({
    type: [String],
    description: 'comma separated: skillIds=a,b,c',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetTo?: number;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updatedFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updatedTo?: Date;

  @ApiPropertyOptional({ enum: SERVICE_REQUEST_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SERVICE_REQUEST_SORT_FIELDS)
  sortBy?: (typeof SERVICE_REQUEST_SORT_FIELDS)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}