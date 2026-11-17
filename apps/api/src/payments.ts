import {
  BadGatewayException,
  ConflictException,
  Controller,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from './prisma';
import { AuthGuard, AuthRequest, Roles } from './common';

type Verification = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: { orderId?: string };
  customer?: { email?: string };
};
@Injectable()
export class PaystackClient {
  async request<T>(path: string, body?: unknown): Promise<T> {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key)
      throw new ServiceUnavailableException(
        'Payments are not configured yet. Add PAYSTACK_SECRET_KEY to the API environment and restart the API.',
      );
    try {
      const response = await fetch(`https://api.paystack.co${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      });
      const result = (await response.json()) as { status: boolean; data: T };
      if (!response.ok || !result.status) throw new Error('Provider rejected request');
      return result.data;
    } catch (error) {
      throw new BadGatewayException('Unable to connect to Paystack. Please try again.', {
        cause: error,
      });
    }
  }
}
@Injectable()
export class PaymentsService {
  constructor(
    private db: PrismaService,
    private paystack: PaystackClient,
  ) {}
  private async own(id: string, userId: string) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: { user: { select: { email: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
  async initialize(id: string, userId: string, origin: string) {
    const order = await this.own(id, userId);
    if (order.status === 'CANCELLED')
      throw new ConflictException('Cancelled orders cannot be paid');
    if (order.paymentStatus === 'PAID') return { paid: true };
    if (order.paymentCheckoutUrl) return { authorizationUrl: order.paymentCheckoutUrl };
    if (order.paymentStatus === 'PROCESSING')
      throw new ConflictException(
        'Payment initialization is in progress. Please check payment status before trying again.',
      );
    if (!order.totalMinor) {
      const updated = await this.db.order.updateMany({
        where: { id, userId, status: { not: 'CANCELLED' }, paymentStatus: 'UNPAID' },
        data: { paymentStatus: 'PAID', status: 'CONFIRMED', paidAt: new Date() },
      });
      if (!updated.count) throw new ConflictException('Order changed. Please refresh.');
      return { paid: true };
    }
    if (!process.env.PAYSTACK_SECRET_KEY)
      throw new ServiceUnavailableException(
        'Payments are not configured yet. Add PAYSTACK_SECRET_KEY to the API environment and restart the API.',
      );
    const reference = `stockroom-${randomUUID()}`;
    const locked = await this.db.order.updateMany({
      where: { id, userId, status: { not: 'CANCELLED' }, paymentStatus: 'UNPAID' },
      data: { paymentStatus: 'PROCESSING', paymentReference: reference },
    });
    if (!locked.count)
      throw new ConflictException('Payment is already starting. Please refresh the order.');
    try {
      const result = await this.paystack.request<{ authorization_url: string; reference: string }>(
        '/transaction/initialize',
        {
          email: order.user.email,
          amount: order.totalMinor,
          currency: 'NGN',
          reference,
          callback_url: `${origin}/orders/${id}?payment=return`,
          metadata: JSON.stringify({ orderId: id }),
        },
      );
      const url = new URL(result.authorization_url);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'checkout.paystack.com' ||
        result.reference !== reference
      )
        throw new BadGatewayException('Paystack returned an invalid checkout response.');
      await this.db.order.update({ where: { id }, data: { paymentCheckoutUrl: url.toString() } });
      return { authorizationUrl: url.toString() };
    } catch (error) {
      await this.db.order.updateMany({
        where: {
          id,
          paymentStatus: 'PROCESSING',
          paymentReference: reference,
          paymentCheckoutUrl: null,
        },
        data: { paymentStatus: 'UNPAID', paymentReference: null },
      });
      throw error;
    }
  }
  async verify(id: string, userId: string) {
    const order = await this.own(id, userId);
    if (order.paymentStatus === 'PAID') return { paid: true };
    if (!order.paymentReference) return { paid: false, providerStatus: 'not_started' };
    const result = await this.paystack.request<Verification>(
      `/transaction/verify/${encodeURIComponent(order.paymentReference)}`,
    );
    if (
      result.reference !== order.paymentReference ||
      result.amount !== order.totalMinor ||
      result.currency !== 'NGN' ||
      result.metadata?.orderId !== id ||
      result.customer?.email?.toLowerCase() !== order.user.email.toLowerCase()
    )
      throw new ConflictException('Payment details do not match this order. Contact support.');
    if (result.status !== 'success') return { paid: false, providerStatus: result.status };
    const updated = await this.db.order.updateMany({
      where: {
        id,
        userId,
        status: { not: 'CANCELLED' },
        paymentReference: result.reference,
        paymentStatus: { not: 'PAID' },
      },
      data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'CONFIRMED' },
    });
    if (!updated.count && order.status === 'CANCELLED')
      throw new ConflictException('Payment received for a cancelled order. Contact support.');
    return { paid: true };
  }
}
@Controller('orders/:id/payment')
@UseGuards(AuthGuard)
@Roles('CUSTOMER')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}
  @Post() initialize(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    const origin = req.headers.origin;
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim());
    if (process.env.NODE_ENV !== 'production')
      allowed.push('http://localhost:5173', 'http://localhost:5174');
    const callbackOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
    return this.payments.initialize(id, req.user.sub, callbackOrigin);
  }
  @Post('verify') verify(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.payments.verify(id, req.user.sub);
  }
}
