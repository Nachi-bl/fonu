import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from './prisma';
import { LoginDto, RegisterDto } from './dto';
import { AuthGuard, AuthRequest } from './common';
const safeSelect = { id: true, name: true, email: true, role: true } as const;
@Injectable()
export class AuthService {
  constructor(
    private db: PrismaService,
    private jwt: JwtService,
  ) {}
  async register(dto: RegisterDto) {
    const user = await this.db.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        passwordHash: await hash(dto.password, 12),
        role: 'CUSTOMER',
      },
      select: safeSelect,
    });
    return this.session(user);
  }
  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Email or password is incorrect');
    return this.session({ id: user.id, name: user.name, email: user.email, role: user.role });
  }
  private async session(user: { id: string; name: string; email: string; role: string }) {
    return { accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }), user };
  }
}
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private auth: AuthService,
    private db: PrismaService,
  ) {}
  @Post('register') register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }
  @Post('login') login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() req: AuthRequest) {
    return this.db.user.findUniqueOrThrow({ where: { id: req.user.sub }, select: safeSelect });
  }
}
