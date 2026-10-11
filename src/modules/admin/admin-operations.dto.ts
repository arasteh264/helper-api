import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const AUDIT_TARGET_TYPES = [
  'USER',
  'PROVIDER',
  'PROVIDER_DOCUMENT',
  'PAYOUT',
  'SERVICE_REQUEST',
  'SPECIALTY',
  'CHAT',
  'COMMISSION',
  'PLATFORM_SETTING',
] as const;

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
  @IsIn(AUDIT_TARGET_TYPES)
  targetType?: (typeof AUDIT_TARGET_TYPES)[number];
}
