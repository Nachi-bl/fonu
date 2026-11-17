import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { ImagesService, MAX_IMAGE_BYTES } from './images';
import { PrismaService } from './prisma';
import { AuthGuard, Roles } from './common';
import { ListDto, ProductDto, UpdateProductDto } from './dto';
@Controller('products')
export class ProductsController {
  constructor(
    private db: PrismaService,
    private images: ImagesService,
  ) {}
  @Post('images/upload')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('images', 7, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 7, fields: 0, parts: 7 },
    }),
  )
  upload(@UploadedFiles() files: Express.Multer.File[]) {
    return this.images.upload(files);
  }
  @Get() async list(@Query() q: ListDto) {
    return this.page(q, false);
  }
  @Get('inventory') @UseGuards(AuthGuard) @Roles('ADMIN') inventory(@Query() q: ListDto) {
    return this.page(q, true);
  }
  private async page(q: ListDto, admin: boolean) {
    const where = {
      ...(!admin ? { isActive: true } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { sku: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.product.count({ where }),
    ]);
    return { data, total, page: q.page, limit: q.limit };
  }
  @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.db.product.findFirstOrThrow({ where: { id, isActive: true } });
  }
  @Post() @UseGuards(AuthGuard) @Roles('ADMIN') create(@Body() dto: ProductDto) {
    return this.db.product.create({ data: dto });
  }
  @Patch(':id') @UseGuards(AuthGuard) @Roles('ADMIN') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.db.product.update({ where: { id }, data: dto });
  }
  @Delete(':id') @UseGuards(AuthGuard) @Roles('ADMIN') archive(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.db.product.update({ where: { id }, data: { isActive: false } });
  }
}
