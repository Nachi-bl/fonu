import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
export class LoginDto {
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Length(10, 72) password!: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @Length(2, 80) name!: string;
}
export class ProductDto {
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(1, 2000) description!: string;
  @IsString() @Length(1, 60) category!: string;
  @IsString() @Length(1, 50) sku!: string;
  @IsInt() @Min(0) @Max(100000000) priceMinor!: number;
  @IsInt() @Min(0) @Max(1000000) stockQuantity!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 2048, { each: true })
  @Matches(/^https:\/\/res\.cloudinary\.com\/[^\s]+$|^\/images\/products\/[a-z0-9-]+\.jpg$/, {
    each: true,
    message: 'Images must be uploaded to Cloudinary or use an existing product photo',
  })
  imageUrls?: string[];
}
export class UpdateProductDto extends PartialType(ProductDto) {}
export class ListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsString() @Length(0, 120) search?: string;
  @IsOptional() @IsString() @Length(0, 60) category?: string;
}
export class ItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}
export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: ItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
}
export enum Status {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}
export class StatusDto {
  @IsEnum(Status) status!: Status;
}
