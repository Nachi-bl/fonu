import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
export type Actor = { sub: string; role: 'ADMIN' | 'CUSTOMER' };
export type AuthRequest = Request & { user: Actor };
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Sign in to continue');
    try {
      req.user = await this.jwt.verifyAsync<Actor>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(req.user.role))
      throw new ForbiddenException('You do not have access to this action');
    return true;
  }
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    let status = error instanceof HttpException ? error.getStatus() : 500;
    let message: string | string[] = 'An unexpected error occurred';
    if (error instanceof HttpException) {
      const body = error.getResponse();
      message = typeof body === 'string' ? body : (body as { message: string | string[] }).message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        message = 'This email or SKU already exists';
      }
      if (error.code === 'P2025') {
        status = 404;
        message = 'Resource not found';
      }
    }
    if (status === 500)
      console.error({ requestId, error: error instanceof Error ? error.name : 'UnknownError' });
    res.status(status).json({
      statusCode: status,
      code:
        (
          {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            429: 'RATE_LIMITED',
            413: 'PAYLOAD_TOO_LARGE',
            502: 'UPSTREAM_ERROR',
            503: 'SERVICE_UNAVAILABLE',
          } as Record<number, string>
        )[status] || 'INTERNAL_ERROR',
      message,
      requestId,
    });
  }
}
