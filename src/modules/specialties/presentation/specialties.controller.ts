import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetGroupedSpecialtiesUseCase } from '../application/get-grouped-specialties.use-case';
import { GroupedSpecialtiesQueryDto } from './dto/grouped-specialties-query.dto';

@ApiTags('Specialties')
@Controller('specialties')
export class SpecialtiesController {
  constructor(
    private readonly getGroupedSpecialtiesUseCase: GetGroupedSpecialtiesUseCase,
  ) {}

  @ApiOperation({ summary: 'List active specialty groups' })
  @Get('groups')
  async getGroups() {
    const data = await this.getGroupedSpecialtiesUseCase.getActiveGroups();
    return { data };
  }

  @ApiOperation({ summary: 'List active specialties in a group' })
  @Get('groups/:groupId/specialties')
  async getGroupSpecialties(@Param('groupId', ParseUUIDPipe) groupId: string) {
    const data =
      await this.getGroupedSpecialtiesUseCase.getSpecialtiesByGroupId(groupId);
    return { data };
  }

  @ApiOperation({
    summary: 'List specialty groups with active provider counts',
  })
  @Get('grouped')
  async getGrouped(@Query() query: GroupedSpecialtiesQueryDto) {
    const data = await this.getGroupedSpecialtiesUseCase.execute({
      search: query.search,
    });

    return { data };
  }
}
