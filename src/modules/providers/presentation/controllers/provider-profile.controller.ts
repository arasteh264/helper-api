import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from 'src/modules/auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from 'src/modules/auth/domain/services/token-generator.port';
import { CreateProviderProfileUseCase } from '../../application/create-provider-profile.use-case';
import { CreateProviderProfileDto } from '../../application/dto/create-provider-profile.dto';
import { AddSkillDto } from '../../application/dto/add-skill.dto';
import { ProviderProfileResponseDto } from '../../application/dto/provider-profile-response.dto';
import { AddSkillToProviderUseCase } from '../../application/dd-skill-to-provider.use-case';

@ApiTags('Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProviderProfileController {
  constructor(
    private readonly createProviderProfileUseCase: CreateProviderProfileUseCase,
    private readonly addSkillToProviderUseCase: AddSkillToProviderUseCase,
  ) {}

  @ApiOperation({ summary: 'Become a provider (create provider profile)' })
  @Post('profile')
  async createProfile(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreateProviderProfileDto,
  ) {
    const profile = await this.createProviderProfileUseCase.execute(
      currentUser.userId,
      dto.bio ?? null,
    );
    return ProviderProfileResponseDto.fromEntity(profile);
  }

  @ApiOperation({ summary: 'Add a skill to your provider profile' })
  @Post('profile/skills')
  async addSkill(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: AddSkillDto,
  ) {
    await this.addSkillToProviderUseCase.execute(currentUser.userId, dto.skillName);
    return { message: 'Skill added successfully' };
  }
}