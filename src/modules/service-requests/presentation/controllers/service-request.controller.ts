import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from 'src/modules/auth/domain/services/token-generator.port';
import { CreateServiceRequestUseCase } from '../../application/create-service-request.use-case';
import { AddSkillToRequestUseCase } from '../../application/add-skill-to-request.use-case';
import { CreateServiceRequestDto } from '../../application/dto/create-service-request.dto';
import { AddSkillToRequestDto } from '../../application/dto/add-skill-to-request.dto';
import { ServiceRequestResponseDto } from '../../application/dto/service-request-response.dto';

@ApiTags('Service Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('service-requests')
export class ServiceRequestController {
  constructor(
    private readonly createServiceRequestUseCase: CreateServiceRequestUseCase,
    private readonly addSkillToRequestUseCase: AddSkillToRequestUseCase,
  ) {}

  @ApiOperation({ summary: 'Create a new service request' })
  @Post()
  async create(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreateServiceRequestDto,
  ) {
    const request = await this.createServiceRequestUseCase.execute({
      customerId: currentUser.userId,
      title: dto.title,
      description: dto.description,
    });
    return ServiceRequestResponseDto.fromEntity(request);
  }

  @ApiOperation({ summary: 'Add a required skill to your service request' })
  @Post(':id/skills')
  async addSkill(
    @Param('id') id: string,
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: AddSkillToRequestDto,
  ) {
    await this.addSkillToRequestUseCase.execute(id, currentUser.userId, dto.skillName);
    return { message: 'Skill added to service request' };
  }
}