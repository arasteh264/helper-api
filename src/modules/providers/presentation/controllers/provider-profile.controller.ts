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
  UploadedFiles,
} from '@nestjs/common';

import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import 'multer';

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
import { GetApprovedProvidersUseCase } from '../../application/get-approved-providers.use-case';
import { UpdateProviderProfileUseCase } from '../../application/update-provider-profile.use-case';
import { RemoveSkillFromProviderUseCase } from '../../application/remove-skill-from-provider.use-case';
import { UploadProviderAvatarUseCase } from '../../application/upload-provider-avatar.use-case';
import { RemoveProviderAvatarUseCase } from '../../application/remove-provider-avatar.use-case';

import { CreateProviderProfileDto } from '../../application/dto/create-provider-profile.dto';
import { AddSkillDto } from '../../application/dto/add-skill.dto';
import { ProviderProfileResponseDto } from '../../application/dto/provider-profile-response.dto';
import { UpdateProviderProfileDto } from '../../application/dto/update-provider-profile.dto';
import { DeletePortfolioItemUseCase } from '../../application/portfolio/delete-portfolio-item.use-case';
import { CreatePortfolioItemUseCase } from '../../application/portfolio/create-portfolio-item.use-case';
import { GetMyPortfolioUseCase } from '../../application/portfolio/get-my-portfolio.use-case';
import { AddImageToPortfolioItemUseCase } from '../../application/portfolio/add-image-to-portfolio-item.use-case';
import { DeletePortfolioItemImageUseCase } from '../../application/portfolio/delete-portfolio-item-image.use-case';
import { CreatePortfolioItemDto } from '../../application/dto/create-portfolio-item.dto';
import { UploadProviderDocumentDto } from '../../application/dto/upload-provider-document.dto';
import { UploadProviderDocumentUseCase } from '../../application/upload-provider-document.use-case';
import { GetMyDocumentsUseCase } from '../../application/get-my-documents.use-case';

@ApiTags('Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProviderProfileController {
  constructor(
    private readonly createProviderProfileUseCase: CreateProviderProfileUseCase,
    private readonly addSkillToProviderUseCase: AddSkillToProviderUseCase,
    private readonly getMyProfileUseCase: GetMyProviderProfileUseCase,
    private readonly getApprovedProvidersUseCase: GetApprovedProvidersUseCase,
    private readonly updateProfileUseCase: UpdateProviderProfileUseCase,
    private readonly removeSkillUseCase: RemoveSkillFromProviderUseCase,
    private readonly uploadAvatarUseCase: UploadProviderAvatarUseCase,
    private readonly removeAvatarUseCase: RemoveProviderAvatarUseCase,
    private readonly createPortfolioItemUseCase: CreatePortfolioItemUseCase,
    private readonly getMyPortfolioUseCase: GetMyPortfolioUseCase,
    private readonly deletePortfolioItemUseCase: DeletePortfolioItemUseCase,
    private readonly addImageToPortfolioItemUseCase: AddImageToPortfolioItemUseCase,
    private readonly deletePortfolioItemImageUseCase: DeletePortfolioItemImageUseCase,
    private readonly uploadProviderDocumentUseCase: UploadProviderDocumentUseCase,
    private readonly getMyDocumentsUseCase: GetMyDocumentsUseCase,
  ) {}

  @ApiOperation({ summary: 'Get all approved providers' })
  @Get()
  getAllProviders() {
    return this.getApprovedProvidersUseCase.execute();
  }

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
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser() currentUser: TokenPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp)$/,
          }),
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
  @ApiOperation({ summary: 'Get my portfolio items' })
  @Get('profile/portfolio')
  getPortfolio(@CurrentUser() currentUser: TokenPayload) {
    return this.getMyPortfolioUseCase.execute(currentUser.userId);
  }

  @ApiOperation({ summary: 'Create a portfolio item with one or more images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @Post('profile/portfolio')
  @UseInterceptors(FilesInterceptor('files', 5))
  createPortfolioItem(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreatePortfolioItemDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 3 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.createPortfolioItemUseCase.execute(
      currentUser.userId,
      files.map((f) => f.buffer),
      dto.title,
      dto.description,
    );
  }

  @ApiOperation({ summary: 'Add an image to an existing portfolio item' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Post('profile/portfolio/:itemId/images')
  @UseInterceptors(FileInterceptor('file'))
  addPortfolioItemImage(
    @CurrentUser() currentUser: TokenPayload,
    @Param('itemId') itemId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 3 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.addImageToPortfolioItemUseCase.execute(
      currentUser.userId,
      itemId,
      file.buffer,
    );
  }

  @ApiOperation({ summary: 'Delete a single image from a portfolio item' })
  @Delete('profile/portfolio/:itemId/images/:imageId')
  async deletePortfolioItemImage(
    @CurrentUser() currentUser: TokenPayload,
    @Param('itemId') itemId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.deletePortfolioItemImageUseCase.execute(
      currentUser.userId,
      itemId,
      imageId,
    );
    return { message: 'Image removed' };
  }

  @ApiOperation({ summary: 'Delete an entire portfolio item' })
  @Delete('profile/portfolio/:itemId')
  async deletePortfolioItem(
    @CurrentUser() currentUser: TokenPayload,
    @Param('itemId') itemId: string,
  ) {
    await this.deletePortfolioItemUseCase.execute(currentUser.userId, itemId);
    return { message: 'Portfolio item removed' };
  }
  @ApiOperation({ summary: 'Get my verification documents' })
  @Get('profile/documents')
  getDocuments(@CurrentUser() currentUser: TokenPayload) {
    return this.getMyDocumentsUseCase.execute(currentUser.userId);
  }

  @ApiOperation({ summary: 'Upload / replace a verification document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: [
            'NATIONAL_CARD',
            'BUSINESS_LICENSE',
            'CERTIFICATE',
            'COMMITMENT_LETTER',
            'CRIMINAL_RECORD',
            'OTHER',
          ],
        },
      },
    },
  })
  @Post('profile/documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: UploadProviderDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|pdf)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadProviderDocumentUseCase.execute(
      currentUser.userId,
      dto.type as any,
      file.buffer,
    );
  }
}
