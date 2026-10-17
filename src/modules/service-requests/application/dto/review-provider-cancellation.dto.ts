import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ReviewProviderCancellationDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ValidateIf(
    (dto: ReviewProviderCancellationDto) =>
      dto.note !== undefined || dto.decision === 'REJECT',
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5, {
    message: 'برای رد درخواست، دلیل را حداقل در ۵ نویسه بنویسید',
  })
  @MaxLength(1000)
  note?: string;
}
