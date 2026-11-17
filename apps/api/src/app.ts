import './env';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma';
import { AuthController, AuthService } from './auth';
import { AuthGuard } from './common';
import { ProductsController } from './products';
import { OrdersController, OrdersService } from './orders';
import { ImagesService } from './images';
import { PaymentsController, PaymentsService, PaystackClient } from './payments';
@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '1h' } }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [AuthController, ProductsController, OrdersController, PaymentsController],
  providers: [
    PrismaService,
    AuthService,
    OrdersService,
    ImagesService,
    PaymentsService,
    PaystackClient,
    AuthGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
