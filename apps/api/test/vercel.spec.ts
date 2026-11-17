import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  INestApplication,
  Module,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import request from 'supertest';
import { ErrorFilter } from '../src/common';
import { ListDto, RegisterDto } from '../src/dto';

jest.mock('../dist/bootstrap', () => ({ createApplication: jest.fn() }), { virtual: true });

@Controller('api/v1')
class DeploymentController {
  @Get(['products', 'products/inventory', 'orders']) list(@Query() query: ListDto) {
    return query;
  }
  @Post('auth/register') register(@Body() body: RegisterDto) {
    return body;
  }
}
@Module({ controllers: [DeploymentController] })
class DeploymentModule {}

describe('Vercel request adapter', () => {
  it('routes API requests without capture parameters and preserves static file precedence', () => {
    const config = require('../../../vercel.json') as {
      routes: { src?: string; dest?: string; handle?: string }[];
    };
    const apiRoute = config.routes[0];
    const pattern = new RegExp(`^(?:${apiRoute.src})$`);
    for (const path of ['/api', '/api/v1/products', '/api/docs/swagger-ui.css']) {
      expect(pattern.exec(path)).toHaveLength(1);
    }
    expect(pattern.test('/admin/products')).toBe(false);
    expect(apiRoute.dest).toBe('/api/index.js');
    expect(config.routes[1]).toEqual({ handle: 'filesystem' });
    expect(config.routes[2]).toEqual({ src: '/.*', dest: '/index.html' });
  });
  let app: INestApplication;
  let server: Server;
  const factory = require('../dist/bootstrap').createApplication as jest.Mock;
  let handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;

  beforeAll(async () => {
    app = await NestFactory.create(DeploymentModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ErrorFilter());
    await app.init();
    factory.mockResolvedValue(app);
    handler = require('../../../api/index.js');
    server = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      Object.defineProperty(req, 'query', {
        configurable: true,
        get: () => ({ ...Object.fromEntries(url.searchParams), path: url.pathname.slice(5) }),
      });
      void handler(req, res);
    });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('ignores platform route metadata while retaining the real URL query', async () => {
    for (const path of ['products', 'products/inventory', 'orders']) {
      const result = await request(server)
        .get(`/api/v1/${path}?page=2&limit=8&search=desk%20lamp&category=Workspace`)
        .expect(200);
      expect(result.body).toEqual({
        page: 2,
        limit: 8,
        search: 'desk lamp',
        category: 'Workspace',
      });
    }
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it('supports empty queries and default pagination', async () => {
    const result = await request(server).get('/api/v1/products').expect(200);
    expect(result.body).toEqual({ page: 1, limit: 12 });
  });
  it.each(['path=client-supplied', 'unexpected=true', 'limit=101', 'page=0', 'limit=1&limit=2'])(
    'still rejects invalid user query %s',
    async (query) => {
      await request(server).get(`/api/v1/products?${query}`).expect(400);
    },
  );
  it('keeps body validation enabled for authentication requests', async () => {
    const body = {
      name: 'Customer',
      email: 'customer@example.com',
      password: 'long-test-password',
    };
    const valid = await request(server).post('/api/v1/auth/register').send(body).expect(201);
    expect(valid.body).toEqual(body);
    await request(server)
      .post('/api/v1/auth/register')
      .send({ ...body, role: 'ADMIN' })
      .expect(400);
  });
  it('shares the initialized app across concurrent requests', async () => {
    await Promise.all(
      Array.from({ length: 3 }, () => request(server).get('/api/v1/products?limit=1').expect(200)),
    );
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
