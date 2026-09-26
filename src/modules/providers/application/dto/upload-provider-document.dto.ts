import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum ProviderDocumentTypeDto {
  NATIONAL_CARD = 'NATIONAL_CARD',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  CERTIFICATE = 'CERTIFICATE',
  COMMITMENT_LETTER = 'COMMITMENT_LETTER',
  CRIMINAL_RECORD = 'CRIMINAL_RECORD',
  OTHER = 'OTHER',
}

export class UploadProviderDocumentDto {
  @ApiProperty({
    enum: ProviderDocumentTypeDto,
    example: ProviderDocumentTypeDto.NATIONAL_CARD,
  })
  @IsEnum(ProviderDocumentTypeDto)
  type!: ProviderDocumentTypeDto;
}
