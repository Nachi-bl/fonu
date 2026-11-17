import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from './prisma';
import { Actor, AuthGuard, AuthRequest, Roles } from './common';
import { CheckoutDto, ListDto, Status, StatusDto } from './dto';
@Injectable()
export class OrdersService {
  constructor(private db: PrismaService) {}
  async checkout(userId: string, dto: CheckoutDto) {
    return this.db.$transaction(async (tx) => {
      const items = [];
      let totalMinor = 0;
      for (const item of [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const changed = await tx.product.updateMany({
          where: { id: item.productId, isActive: true, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'An item is unavailable or has insufficient stock. Please refresh your cart.',
          );
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const lineTotalMinor = product.priceMinor * item.quantity;
        totalMinor += lineTotalMinor;
        if (totalMinor > 2147483647)
          throw new ConflictException('Order total exceeds the supported limit');
        items.push({
          productId: product.id,
          quantity: item.quantity,
          unitPriceMinor: product.priceMinor,
          lineTotalMinor,
          productNameSnapshot: product.name,
        });
      }
      return tx.order.create({
        data: { userId, totalMinor, items: { create: items } },
        include: { items: true },
      });
    });
  }
  async change(id: string, status: Status, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, ...(actor.role === 'CUSTOMER' ? { userId: actor.sub } : {}) },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      const changed = await tx.order.updateMany({
        where: {
          id,
          status: 'PENDING',
          ...(status === Status.CANCELLED
            ? { paymentStatus: 'UNPAID', paymentReference: null }
            : {}),
        },
        data: { status },
      });
      if (!changed.count)
        throw new ConflictException(
          'Only pending orders can be changed. Orders with a payment in progress or a completed payment cannot be cancelled.',
        );
      if (status === Status.CANCELLED)
        for (const item of [...order.items].sort((a, b) => a.productId.localeCompare(b.productId)))
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
      return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    });
  }
}
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(
    private db: PrismaService,
    private orders: OrdersService,
  ) {}
  @Post() @Roles('CUSTOMER') create(@Req() req: AuthRequest, @Body() dto: CheckoutDto) {
    return this.orders.checkout(req.user.sub, dto);
  }
  @Get() async list(@Req() req: AuthRequest, @Query() q: ListDto) {
    const where = req.user.role === 'ADMIN' ? {} : { userId: req.user.sub };
    const [data, total] = await this.db.$transaction([
      this.db.order.findMany({
        where,
        include: { items: true, user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.order.count({ where }),
    ]);
    return { data, total, page: q.page, limit: q.limit };
  }
  @Get(':id') async detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.db.order.findFirst({
      where: { id, ...(req.user.role === 'CUSTOMER' ? { userId: req.user.sub } : {}) },
      include: { items: true, user: { select: { name: true, email: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
  @Patch(':id/status') @Roles('ADMIN') change(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.orders.change(id, dto.status, req.user);
  }
  @Delete(':id') cancel(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.change(id, Status.CANCELLED, req.user);
  }
}
