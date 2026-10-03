import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/presentation/guards/admin.guard';

import { CreateSpecialtyGroupUseCase } from '../application/admin/create-specialty-group.use-case';
import { UpdateSpecialtyGroupUseCase } from '../application/admin/update-specialty-group.use-case';
import { DeleteSpecialtyGroupUseCase } from '../application/admin/delete-specialty-group.use-case';
import { CreateSpecialtyUseCase } from '../application/admin/create-specialty.use-case';
import { UpdateSpecialtyUseCase } from '../application/admin/update-specialty.use-case';
import { DeleteSpecialtyUseCase } from '../application/admin/delete-specialty.use-case';
import { GetGroupedSpecialtiesUseCase } from '../application/get-grouped-specialties.use-case';

import {
  CreateSpecialtyGroupDto,
  UpdateSpecialtyGroupDto,
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
} from './dto/admin-specialty.dto';

const ICON_UPLOAD_OPTIONS = {
  limits: { fileSize: 2 * 1024 * 1024 },
};

@ApiTags('Admin - Specialties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/specialties')
export class AdminSpecialtiesController {
  constructor(
    private readonly createGroupUseCase: CreateSpecialtyGroupUseCase,
    private readonly updateGroupUseCase: UpdateSpecialtyGroupUseCase,
    private readonly deleteGroupUseCase: DeleteSpecialtyGroupUseCase,
    private readonly createSpecialtyUseCase: CreateSpecialtyUseCase,
    private readonly updateSpecialtyUseCase: UpdateSpecialtyUseCase,
    private readonly deleteSpecialtyUseCase: DeleteSpecialtyUseCase,
    private readonly getGroupedSpecialtiesUseCase: GetGroupedSpecialtiesUseCase,
  ) {}

  @ApiOperation({ summary: 'List all specialty groups for administration' })
  @Get('groups')
  async getGroups() {
    const data = await this.getGroupedSpecialtiesUseCase.getAdminGroups();
    return { data };
  }

  @ApiOperation({
    summary: 'List all specialties in a group for administration',
  })
  @Get('groups/:groupId/specialties')
  async getGroupSpecialties(@Param('groupId', ParseUUIDPipe) groupId: string) {
    const data =
      await this.getGroupedSpecialtiesUseCase.getAdminSpecialtiesByGroupId(
        groupId,
      );
    return { data };
  }

  @ApiOperation({ summary: 'Create a specialty group' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Post('groups')
  createGroup(
    @Body() dto: CreateSpecialtyGroupDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.createGroupUseCase.execute({
      name: dto.name,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      iconFile: icon,
    });
  }

  @ApiOperation({ summary: 'Update a specialty group' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Patch('groups/:id')
  updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyGroupDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.updateGroupUseCase.execute({
      id,
      name: dto.name,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      iconFile: icon,
    });
  }

  @ApiOperation({ summary: 'Delete a specialty group' })
  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.deleteGroupUseCase.execute(id);
  }

  @ApiOperation({ summary: 'Create a specialty' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Post()
  createSpecialty(
    @Body() dto: CreateSpecialtyDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.createSpecialtyUseCase.execute({
      groupId: dto.groupId,
      name: dto.name,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      iconFile: icon,
      pricingMode: dto.pricingMode,
      hourlyRateToman: dto.hourlyRateToman,
      hourlyUnitLabel: dto.hourlyUnitLabel,
    });
  }

  @ApiOperation({ summary: 'Update a specialty' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Patch(':id')
  updateSpecialty(
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.updateSpecialtyUseCase.execute({
      id,
      groupId: dto.groupId,
      name: dto.name,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      iconFile: icon,
      pricingMode: dto.pricingMode,
      hourlyRateToman: dto.hourlyRateToman,
      hourlyUnitLabel: dto.hourlyUnitLabel,
    });
  }

  @ApiOperation({ summary: 'Delete a specialty' })
  @Delete(':id')
  deleteSpecialty(@Param('id') id: string) {
    return this.deleteSpecialtyUseCase.execute(id);
  }
}
