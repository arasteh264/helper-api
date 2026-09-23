import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { CreateServiceRequestUseCase } from '../../application/create-service-request.use-case';
import { AddSkillToRequestUseCase } from '../../application/add-skill-to-request.use-case';
import { UploadServiceRequestImageUseCase } from '../../application/upload-service-request-image.use-case';
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
    private readonly uploadServiceRequestImageUseCase: UploadServiceRequestImageUseCase, // ← اضافه شد
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
    await this.addSkillToRequestUseCase.execute(
      id,
      currentUser.userId,
      dto.skillName,
    );
    return { message: 'Skill added to service request' };
  }

  @ApiOperation({ summary: 'Upload an image for a service request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
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
    return this.uploadServiceRequestImageUseCase.execute(
      id,
      currentUser.userId,
      file.buffer,
    );
  }
}
