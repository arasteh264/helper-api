import { Module } from '@nestjs/common';
import { BlogController, AdminBlogController } from './blog.controller';
import { BlogService } from './blog.service';
import {
  AdminProviderArticlesController,
  ProviderArticlesController,
  PublicProviderArticlesController,
} from './provider-articles.controller';
import { ProviderArticlesService } from './provider-articles.service';

@Module({
  controllers: [
    BlogController,
    AdminBlogController,
    PublicProviderArticlesController,
    ProviderArticlesController,
    AdminProviderArticlesController,
  ],
  providers: [BlogService, ProviderArticlesService],
})
export class BlogModule {}
