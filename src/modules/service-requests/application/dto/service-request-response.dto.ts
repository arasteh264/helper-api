import { ApiProperty } from '@nestjs/swagger';
import { ServiceRequest } from '../../domain/entities/service-request.entity';
import { ServiceRequestStatus } from '../../domain/entities/service-request-status.enum';

export class ServiceRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: ServiceRequestStatus })
  status!: ServiceRequestStatus;

  @ApiProperty({ type: [String] })
  skillIds!: string[];

  static fromEntity(request: ServiceRequest): ServiceRequestResponseDto {
    const dto = new ServiceRequestResponseDto();
    dto.id = request.id;
    dto.customerId = request.customerId;
    dto.title = request.title;
    dto.description = request.description;
    dto.status = request.status;
    dto.skillIds = request.skillIds;
    return dto;
  }
}