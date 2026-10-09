import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAccountStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AdminAuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn([
    'USER',
    'PROVIDER',
    'PROVIDER_DOCUMENT',
    'PAYOUT',
    'SERVICE_REQUEST',
    'SPECIALTY',
    'CHAT',
    'COMMISSION',
    'PLATFORM_SETTING',
  ])
  targetType?:
    | 'USER'
    | 'PROVIDER'
    | 'PROVIDER_DOCUMENT'
    | 'PAYOUT'
    | 'SERVICE_REQUEST'
    | 'SPECIALTY'
    | 'CHAT'
    | 'COMMISSION'
    | 'PLATFORM_SETTING';
}

export class AdminExportQueryDto {
  @IsIn(['users', 'providers', 'service-requests', 'payments', 'payouts'])
  type!: 'users' | 'providers' | 'service-requests' | 'payments' | 'payouts';
}
