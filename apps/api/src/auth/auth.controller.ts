import { Body, Controller, HttpCode, HttpStatus, Post, Res, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { Public } from './public.decorator';
import { LoginRateLimitService } from './login-rate-limit.service';
import type { JwtPayload, SignInDto } from './types';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly loginRateLimit: LoginRateLimitService,
    ) { }

    @HttpCode(HttpStatus.OK)
    @Public()
    @Post('login')
    async signIn(
        @Body() signInDto: SignInDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        await this.loginRateLimit.assertAllowed(clientIp(req), signInDto.email)
        return this.authService.signIn(signInDto.email, signInDto.password, res);
    }

    @Public()
    @Post('refresh')
    refresh(@Req() req: Request) {
        return this.authService.refresh(req.cookies?.refresh_token);
    }

    @Public()
    @Post('logout')
    logOut(@Res({ passthrough: true }) res: Response) {
        return this.authService.signOut(res);
    }

    @Get('me')
    me(@Req() req: Request) {
        const user = req.user as JwtPayload
        return this.authService.getMe(user.sub);
    }

}

function clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
    }
    return req.ip || req.socket.remoteAddress || 'unknown'
}
