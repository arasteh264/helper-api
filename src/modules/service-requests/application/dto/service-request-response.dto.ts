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

  @ApiProperty({ nullable: true, type: String })
  specialtyId!: string | null;

  customer?: { name: string; email: string; phone: string } | null;
  specialty?: { name: string } | null;
  skills?: { id: string; name: string }[];
  address?: string | null;
  preferredTime?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  scheduledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  static fromEntity(
    request: ServiceRequest,
    customer?: { name: string; email: string; phone: string } | null,
    skills?: { id: string; name: string }[],
  ): ServiceRequestResponseDto {
    const dto = new ServiceRequestResponseDto();
    dto.id = request.id;
    dto.customerId = request.customerId;
    dto.title = request.title;
    dto.description = request.description;
    dto.status = request.status;
    dto.skillIds = request.skillIds;
    dto.specialtyId = request.specialtyId;
    dto.customer = customer;
    dto.specialty = request.specialtyName ? { name: request.specialtyName } : null;
    dto.skills = skills;
    dto.address = request.address;
    dto.preferredTime = request.preferredTime;
    dto.budgetMin = request.budgetMin;
    dto.budgetMax = request.budgetMax;
    dto.scheduledAt = request.scheduledAt;
    dto.createdAt = request.createdAt;
    dto.updatedAt = request.updatedAt;
    return dto;
  }
}
