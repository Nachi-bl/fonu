import 'reflect-metadata';
import '../src/env';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app';
import { PrismaService } from '../src/prisma';
import { ErrorFilter } from '../src/common';
import { JwtService } from '@nestjs/jwt';
import { ImagesService } from '../src/images';
import { PaystackClient } from '../src/payments';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
jest.setTimeout(30000);
(enabled ? describe : describe.skip)('Order flow against isolated PostgreSQL', () => {
  let app: INestApplication,
    db: PrismaService,
    customer: string,
    other: string,
    admin: string,
    userId: string,
    productId: string;
  const users: string[] = [],
    products: string[] = [];
  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
    )
      throw new Error('TEST_DATABASE_URL must be separate from DATABASE_URL');
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET ||= 'integration-only-secret-with-more-than-32-characters';
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ErrorFilter());
    await app.init();
    db = app.get(PrismaService);
    const jwt = app.get(JwtService);
    for (const role of ['CUSTOMER', 'CUSTOMER', 'ADMIN'] as const) {
      const u = await db.user.create({
        data: {
          name: 'Test user',
          email: `${randomUUID()}@test.local`,
          passwordHash: 'not-used',
          role,
        },
      });
      users.push(u.id);
    }
    userId = users[0];
    customer = await jwt.signAsync({ sub: users[0], role: 'CUSTOMER' });
    other = await jwt.signAsync({ sub: users[1], role: 'CUSTOMER' });
    admin = await jwt.signAsync({ sub: users[2], role: 'ADMIN' });
  });
  beforeEach(async () => {
    const p = await db.product.create({
      data: {
        name: 'Test notebook',
        description: 'Fixture',
        sku: randomUUID(),
        category: 'Workspace',
        priceMinor: 1250,
        stockQuantity: 5,
      },
    });
    productId = p.id;
    products.push(p.id);
  });
  afterAll(async () => {
    if (db) {
      await db.orderItem.deleteMany({ where: { order: { userId: { in: users } } } });
      await db.order.deleteMany({ where: { userId: { in: users } } });
      await db.product.deleteMany({ where: { id: { in: products } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });
  const post = (items: unknown, token = customer) =>
    request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });
  it('persists snapshots, server totals and stock once', async () => {
    const res = await post([{ productId, quantity: 2 }]).expect(201);
    expect(res.body.totalMinor).toBe(2500);
    expect(res.body.items[0].unitPriceMinor).toBe(1250);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
      3,
    );
    expect(await db.orderItem.count({ where: { orderId: res.body.id } })).toBe(1);
    await db.product.update({
      where: { id: productId },
      data: { priceMinor: 9000, name: 'Renamed', isActive: false },
    });
    const saved = await request(app.getHttpServer())
      .get(`/api/v1/orders/${res.body.id}`)
      .set('Authorization', `Bearer ${customer}`)
      .expect(200);
    expect(saved.body.items[0].productNameSnapshot).toBe('Test notebook');
    expect(saved.body.totalMinor).toBe(2500);
  });
  it.each([0, -1, 1.5, 101])('rejects invalid quantity %s', async (quantity) => {
    await post([{ productId, quantity }]).expect(400);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
      5,
    );
  });
  it('rejects duplicate products and untrusted totals', async () => {
    await post([
      { productId, quantity: 1 },
      { productId, quantity: 1 },
    ]).expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({ items: [{ productId, quantity: 1 }], totalMinor: 1 })
      .expect(400);
  });
  it('rejects unauthenticated checkout and customer product creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customer}`)
      .send({})
      .expect(403);
  });
  it('rolls back a mixed cart with insufficient inventory', async () => {
    const count = await db.order.count({ where: { userId } });
    await post([
      { productId, quantity: 1 },
      { productId: randomUUID(), quantity: 1 },
    ]).expect(409);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
      5,
    );
    expect(await db.order.count({ where: { userId } })).toBe(count);
  });
  it('rejects stock shortage without changes', async () => {
    await post([{ productId, quantity: 6 }]).expect(409);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
      5,
    );
  });
  it('allows exactly one simultaneous last-unit purchase', async () => {
    await db.product.update({ where: { id: productId }, data: { stockQuantity: 1 } });
    const results = await Promise.all([
      post([{ productId, quantity: 1 }]),
      post([{ productId, quantity: 1 }]),
    ]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
      0,
    );
    expect(await db.orderItem.count({ where: { productId } })).toBe(1);
  });
  it('enforces ownership and allows admin access', async () => {
    const res = await post([{ productId, quantity: 1 }]);
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${res.body.id}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/orders/${res.body.id}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    const list = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(list.body.total).toBe(0);
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${res.body.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
  });
  it('restores inventory exactly once on concurrent cancellation', async () => {
    const res = await post([{ productId, quantity: 2 }]);
    const cancel = () =>
      request(app.getHttpServer())
        .delete(`/api/v1/orders/${res.body.id}`)
        .set('Authorization', `Bearer ${customer}`);
    const results = await Promise.all([cancel(), cancel()]);
    expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
      5,
    );
  });
  it('only admins can confirm; confirmed orders cannot be cancelled', async () => {
    const res = await post([{ productId, quantity: 1 }]);
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${res.body.id}/status`)
      .set('Authorization', `Bearer ${customer}`)
      .send({ status: 'CONFIRMED' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${res.body.id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/orders/${res.body.id}`)
      .set('Authorization', `Bearer ${customer}`)
      .expect(409);
  });
  it('protects image uploads and accepts a seven-image multipart batch', async () => {
    await request(app.getHttpServer()).post('/api/v1/products/images/signature').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/products/images/signature')
      .set('Authorization', `Bearer ${customer}`)
      .expect(403);
    const upload = jest
      .spyOn(app.get(ImagesService), 'upload')
      .mockResolvedValue({ urls: ['https://res.cloudinary.com/test/image/upload/example.png'] });
    try {
      await request(app.getHttpServer())
        .post('/api/v1/products/images/upload')
        .attach('images', Buffer.from('image'), 'photo.png')
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/products/images/upload')
        .set('Authorization', `Bearer ${customer}`)
        .attach('images', Buffer.from('image'), 'photo.png')
        .expect(403);
      expect(upload).not.toHaveBeenCalled();
      let batch = request(app.getHttpServer())
        .post('/api/v1/products/images/upload')
        .set('Authorization', `Bearer ${admin}`);
      for (let i = 0; i < 7; i++)
        batch = batch.attach('images', Buffer.from('image'), `photo${i}.png`);
      await batch.expect(201);
      expect(upload.mock.calls[0][0]).toHaveLength(7);
      let excess = request(app.getHttpServer())
        .post('/api/v1/products/images/upload')
        .set('Authorization', `Bearer ${admin}`);
      for (let i = 0; i < 8; i++)
        excess = excess.attach('images', Buffer.from('image'), `photo${i}.png`);
      await excess.expect(400);
      expect(upload).toHaveBeenCalledTimes(1);
    } finally {
      upload.mockRestore();
    }
  });
  it('persists ordered galleries and rejects more than seven images', async () => {
    const imageUrls = Array.from(
      { length: 7 },
      (_, i) => `https://res.cloudinary.com/test/image/upload/${i}.png`,
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ imageUrls })
      .expect(200);
    const product = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .expect(200);
    expect(product.body.imageUrls).toEqual(imageUrls);
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ imageUrls: [...imageUrls, 'https://res.cloudinary.com/test/image/upload/8.png'] })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ imageUrls: ['https://untrusted.example/photo.png'] })
      .expect(400);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).imageUrls).toEqual(
      imageUrls,
    );
  });
  it('initializes Paystack with the saved total and verifies payments once', async () => {
    const oldKey = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock';
    const provider = jest.spyOn(app.get(PaystackClient), 'request');
    try {
      const order = await post([{ productId, quantity: 2 }]).expect(201);
      provider.mockImplementation(async (path, body) =>
        path === '/transaction/initialize'
          ? {
              authorization_url: 'https://checkout.paystack.com/test-checkout',
              reference: (body as { reference: string }).reference,
            }
          : {
              status: 'success',
              reference: (await db.order.findUniqueOrThrow({ where: { id: order.body.id } }))
                .paymentReference,
              amount: 2500,
              currency: 'NGN',
              metadata: { orderId: order.body.id },
              customer: {
                email: (await db.user.findUniqueOrThrow({ where: { id: userId } })).email,
              },
            },
      );
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/payment`)
        .set('Authorization', `Bearer ${other}`)
        .expect(404);
      const initialized = await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/payment`)
        .set('Authorization', `Bearer ${customer}`)
        .set('Origin', 'http://localhost:5174')
        .expect(201);
      expect(initialized.body.authorizationUrl).toBe('https://checkout.paystack.com/test-checkout');
      expect(provider.mock.calls[0][1]).toMatchObject({
        amount: 2500,
        currency: 'NGN',
        callback_url: `http://localhost:5174/orders/${order.body.id}?payment=return`,
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/orders/${order.body.id}`)
        .set('Authorization', `Bearer ${customer}`)
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/payment`)
        .set('Authorization', `Bearer ${customer}`)
        .expect(201);
      expect(provider).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 2; i++) {
        const verified = await request(app.getHttpServer())
          .post(`/api/v1/orders/${order.body.id}/payment/verify`)
          .set('Authorization', `Bearer ${customer}`)
          .expect(201);
        expect(verified.body.paid).toBe(true);
      }
      const saved = await db.order.findUniqueOrThrow({ where: { id: order.body.id } });
      expect(saved.paymentStatus).toBe('PAID');
      expect(saved.status).toBe('CONFIRMED');
      expect(saved.paidAt).not.toBeNull();
      expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(
        3,
      );
      expect(provider).toHaveBeenCalledTimes(2);
    } finally {
      provider.mockRestore();
      if (oldKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = oldKey;
    }
  });
  it('does not mark an order paid when provider amounts do not match', async () => {
    const order = await post([{ productId, quantity: 1 }]).expect(201);
    await db.order.update({
      where: { id: order.body.id },
      data: { paymentStatus: 'PROCESSING', paymentReference: `test_${randomUUID()}` },
    });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.body.id } });
    const provider = jest.spyOn(app.get(PaystackClient), 'request').mockResolvedValue({
      status: 'success',
      reference: saved.paymentReference,
      amount: 1,
      currency: 'NGN',
      metadata: { orderId: order.body.id },
      customer: { email: (await db.user.findUniqueOrThrow({ where: { id: userId } })).email },
    });
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/payment/verify`)
        .set('Authorization', `Bearer ${customer}`)
        .expect(409);
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: order.body.id } })).paymentStatus,
      ).toBe('PROCESSING');
    } finally {
      provider.mockRestore();
    }
  });
  it('keeps an order unpaid when Paystack is not configured', async () => {
    const oldKey = process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    try {
      const order = await post([{ productId, quantity: 1 }]).expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${order.body.id}/payment`)
        .set('Authorization', `Bearer ${customer}`)
        .expect(503);
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: order.body.id } })).paymentStatus,
      ).toBe('UNPAID');
    } finally {
      if (oldKey !== undefined) process.env.PAYSTACK_SECRET_KEY = oldKey;
    }
  });
  it('registers only customers and never returns hashes', async () => {
    const email = `${randomUUID()}@test.local`;
    const registration = { name: 'New customer', email, password: 'a-long-test-password' };
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...registration, role: 'ADMIN' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(registration)
      .expect(201);
    users.push(res.body.user.id);
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user.passwordHash).toBeUndefined();
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    expect(u.passwordHash).not.toBe(registration.password);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: registration.password })
      .expect(201);
  });
});
