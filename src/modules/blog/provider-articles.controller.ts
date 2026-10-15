import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import {
  AdminProviderArticleListQueryDto,
  ProviderArticleListQueryDto,
  RateProviderArticleDto,
  ReviewProviderArticleDto,
  SubmitProviderArticleDto,
} from './dto/provider-article.dto';
import { ProviderArticlesService } from './provider-articles.service';

@ApiTags('Provider Articles')
@Controller('articles')
export class PublicProviderArticlesController {
  constructor(private readonly articles: ProviderArticlesService) {}

  @ApiOperation({ summary: 'List approved provider educational articles' })
  @Get()
  list(@Query() query: ProviderArticleListQueryDto) {
    return this.articles.listPublic(query);
  }

  @ApiOperation({ summary: 'Get an approved provider article by slug' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.articles.getPublic(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Rate an approved provider article' })
  @Post(':id/ratings')
  rate(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateProviderArticleDto,
  ) {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('ثبت امتیاز فقط برای مشتری مجاز است');
    }
    return this.articles.rate(id, user.userId, dto);
  }
}

@ApiTags('Provider Articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('provider/articles')
export class ProviderArticlesController {
  constructor(private readonly articles: ProviderArticlesService) {}

  @ApiOperation({ summary: 'Submit an educational article for admin review' })
  @Post()
  submit(
    @CurrentUser() user: TokenPayload,
    @Body() dto: SubmitProviderArticleDto,
  ) {
    if (user.role !== 'PROVIDER') {
      throw new ForbiddenException('ثبت مقاله فقط برای متخصص مجاز است');
    }
    return this.articles.submit(user.userId, dto);
  }

  @ApiOperation({ summary: 'List my submitted provider articles' })
  @Get()
  listMine(@CurrentUser() user: TokenPayload) {
    if (user.role !== 'PROVIDER') {
      throw new ForbiddenException('فقط متخصص می‌تواند مقاله‌های خود را ببیند');
    }
    return this.articles.listMine(user.userId);
  }
}

@ApiTags('Admin - Provider Articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/articles')
export class AdminProviderArticlesController {
  constructor(private readonly articles: ProviderArticlesService) {}

  @ApiOperation({ summary: 'List provider articles for moderation' })
  @Get()
  list(@Query() query: AdminProviderArticleListQueryDto) {
    return this.articles.listAdmin(query);
  }

  @ApiOperation({ summary: 'Approve or reject a submitted provider article' })
  @Patch(':id/review')
  review(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewProviderArticleDto,
  ) {
    return this.articles.review(id, user.userId, dto);
  }
}
