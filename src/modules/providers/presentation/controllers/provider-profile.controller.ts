import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { CreateProviderProfileUseCase } from '../../application/create-provider-profile.use-case';
import { AddSkillToProviderUseCase } from '../../application/dd-skill-to-provider.use-case';
import { GetMyProviderProfileUseCase } from '../../application/get-my-provider-profile.use-case';
import { UpdateProviderProfileUseCase } from '../../application/update-provider-profile.use-case';
import { RemoveSkillFromProviderUseCase } from '../../application/remove-skill-from-provider.use-case';
import { UploadProviderAvatarUseCase } from '../../application/upload-provider-avatar.use-case';
import { CreateProviderProfileDto } from '../../application/dto/create-provider-profile.dto';

import { AddSkillDto } from '../../application/dto/add-skill.dto';
import { ProviderProfileResponseDto } from '../../application/dto/provider-profile-response.dto';
import { RemoveProviderAvatarUseCase } from '../../application/remove-provider-avatar.use-case';
import { UpdateProviderProfileDto } from '../../application/dto/update-provider-profile.dto';

@ApiTags('Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProviderProfileController {
  constructor(
    private readonly createProviderProfileUseCase: CreateProviderProfileUseCase,
    private readonly addSkillToProviderUseCase: AddSkillToProviderUseCase,
    private readonly getMyProfileUseCase: GetMyProviderProfileUseCase,
    private readonly updateProfileUseCase: UpdateProviderProfileUseCase,
    private readonly removeSkillUseCase: RemoveSkillFromProviderUseCase,
    private readonly uploadAvatarUseCase: UploadProviderAvatarUseCase,
    private readonly removeAvatarUseCase: RemoveProviderAvatarUseCase,
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

  @ApiOperation({ summary: 'Get my full provider profile' })
  @Get('profile')
  getProfile(@CurrentUser() currentUser: TokenPayload) {
    return this.getMyProfileUseCase.execute(currentUser.userId);
  }

  @ApiOperation({ summary: 'Update my provider profile' })
  @Patch('profile')
  updateProfile(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.updateProfileUseCase.execute(currentUser.userId, dto);
  }

  @ApiOperation({ summary: 'Add a skill to your provider profile' })
  @Post('profile/skills')
  async addSkill(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: AddSkillDto,
  ) {
    await this.addSkillToProviderUseCase.execute(
      currentUser.userId,
      dto.skillName,
    );
    return { message: 'Skill added successfully' };
  }

  @ApiOperation({ summary: 'Remove a skill from my profile' })
  @Delete('profile/skills/:skillId')
  async removeSkill(
    @CurrentUser() currentUser: TokenPayload,
    @Param('skillId') skillId: string,
  ) {
    await this.removeSkillUseCase.execute(currentUser.userId, skillId);
    return { message: 'Skill removed' };
  }

  @ApiOperation({ summary: 'Upload / replace my avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser() currentUser: TokenPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadAvatarUseCase.execute(currentUser.userId, file.buffer);
  }

  @ApiOperation({ summary: 'Remove my avatar' })
  @Delete('profile/avatar')
  async removeAvatar(@CurrentUser() currentUser: TokenPayload) {
    await this.removeAvatarUseCase.execute(currentUser.userId);
    return { message: 'Avatar removed' };
  }
}
