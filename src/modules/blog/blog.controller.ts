import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { BlogService } from './blog.service';
import { AdminBlogQueryDto } from './dto/admin-blog-query.dto';
import { BlogPostFieldsDto } from './dto/blog-content-block.dto';

class PublicBlogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;
}

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @ApiOperation({ summary: 'List published blog posts' })
  @Get()
  list(@Query() query: PublicBlogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 12, 50);
    return this.blogService.listPublic({
      page,
      pageSize,
      search: query.search?.trim().slice(0, 100),
      category: query.category?.trim().slice(0, 100),
      tag: query.tag?.trim().slice(0, 100),
    });
  }

  @ApiOperation({ summary: 'Get one published blog post by slug' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.blogService.getPublicBySlug(slug);
  }
}

@ApiTags('Admin - Blog')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/blog')
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @ApiOperation({ summary: 'List blog posts for administration' })
  @Get()
  list(@Query() query: AdminBlogQueryDto) {
    return this.blogService.listAdmin(query);
  }

  @ApiOperation({ summary: 'Get a blog post draft or published post' })
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.blogService.getAdminById(id);
  }

  @ApiOperation({ summary: 'Create a blog post' })
  @Post()
  create(@Body() body: BlogPostFieldsDto) {
    return this.blogService.create(body);
  }

  @ApiOperation({ summary: 'Update and publish or unpublish a blog post' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BlogPostFieldsDto,
  ) {
    return this.blogService.update(id, body);
  }
}
