import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveServiceRequestDisputeDto {
  @ApiProperty({ enum: ['PROVIDER', 'BUYER'] })
  @IsIn(['PROVIDER', 'BUYER'])
  resolution!: 'PROVIDER' | 'BUYER';

  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
