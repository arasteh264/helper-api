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

import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/presentation/guards/admin.guard';
import type { TokenPayload } from '../../auth/domain/services/token-generator.port';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

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
    private readonly prisma: PrismaService,
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
  async createGroup(
    @CurrentUser() admin: TokenPayload,
    @Body() dto: CreateSpecialtyGroupDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const group = await this.createGroupUseCase.execute({
      name: dto.name,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      iconFile: icon,
    });
    await this.recordAction(
      admin.userId,
      'SPECIALTY_GROUP_CREATED',
      group.id,
      null,
      {
        name: group.name,
        slug: group.slug,
        sortOrder: group.sortOrder,
        isActive: group.isActive,
      },
    );
    return group;
  }

  @ApiOperation({ summary: 'Update a specialty group' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Patch('groups/:id')
  async updateGroup(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyGroupDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const before = await this.prisma.specialtyGroup.findUnique({
      where: { id },
      select: { name: true, slug: true, sortOrder: true, isActive: true },
    });
    const group = await this.updateGroupUseCase.execute({
      id,
      name: dto.name,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      iconFile: icon,
    });
    await this.recordAction(
      admin.userId,
      'SPECIALTY_GROUP_UPDATED',
      id,
      before,
      {
        name: group.name,
        slug: group.slug,
        sortOrder: group.sortOrder,
        isActive: group.isActive,
      },
    );
    return group;
  }

  @ApiOperation({ summary: 'Delete a specialty group' })
  @Delete('groups/:id')
  async deleteGroup(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
  ) {
    const before = await this.prisma.specialtyGroup.findUnique({
      where: { id },
      select: { name: true, slug: true, sortOrder: true, isActive: true },
    });
    await this.deleteGroupUseCase.execute(id);
    await this.recordAction(
      admin.userId,
      'SPECIALTY_GROUP_DELETED',
      id,
      before,
      null,
    );
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Create a specialty' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Post()
  async createSpecialty(
    @CurrentUser() admin: TokenPayload,
    @Body() dto: CreateSpecialtyDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const specialty = await this.createSpecialtyUseCase.execute({
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
    await this.recordAction(
      admin.userId,
      'SPECIALTY_CREATED',
      specialty.id,
      null,
      {
        name: specialty.name,
        slug: specialty.slug,
        groupId: specialty.groupId,
        sortOrder: specialty.sortOrder,
        isActive: specialty.isActive,
        pricingMode: specialty.pricingMode,
        hourlyRateToman: specialty.hourlyRateToman,
      },
    );
    return specialty;
  }

  @ApiOperation({ summary: 'Update a specialty' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('icon', ICON_UPLOAD_OPTIONS))
  @Patch(':id')
  async updateSpecialty(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const before = await this.prisma.specialty.findUnique({
      where: { id },
      select: {
        name: true,
        slug: true,
        groupId: true,
        sortOrder: true,
        isActive: true,
        pricingMode: true,
        hourlyRateToman: true,
      },
    });
    const specialty = await this.updateSpecialtyUseCase.execute({
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
    await this.recordAction(admin.userId, 'SPECIALTY_UPDATED', id, before, {
      name: specialty.name,
      slug: specialty.slug,
      groupId: specialty.groupId,
      sortOrder: specialty.sortOrder,
      isActive: specialty.isActive,
      pricingMode: specialty.pricingMode,
      hourlyRateToman: specialty.hourlyRateToman,
    });
    return specialty;
  }

  @ApiOperation({ summary: 'Delete a specialty' })
  @Delete(':id')
  async deleteSpecialty(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
  ) {
    const before = await this.prisma.specialty.findUnique({
      where: { id },
      select: {
        name: true,
        slug: true,
        groupId: true,
        sortOrder: true,
        isActive: true,
        pricingMode: true,
        hourlyRateToman: true,
      },
    });
    await this.deleteSpecialtyUseCase.execute(id);
    await this.recordAction(
      admin.userId,
      'SPECIALTY_DELETED',
      id,
      before,
      null,
    );
    return { deleted: true };
  }

  private recordAction(
    actorUserId: string,
    action: string,
    targetId: string,
    beforeState: Record<string, string | number | boolean | null> | null,
    afterState: Record<string, string | number | boolean | null> | null,
  ) {
    return this.prisma.adminAuditLog.create({
      data: {
        actorUserId,
        action,
        targetType: 'SPECIALTY',
        targetId,
        reason: 'مدیر تنظیمات گروه‌ها و تخصص‌ها را تغییر داد',
        beforeState: beforeState ?? undefined,
        afterState: afterState ?? undefined,
      },
    });
  }
}
