import { Module } from '@nestjs/common';
import { BlogController, AdminBlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService],
})
export class BlogModule {}
