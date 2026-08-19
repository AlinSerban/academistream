import { Body, Controller, HttpCode, HttpStatus, Post, Res, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @HttpCode(HttpStatus.OK)
    @Public()
    @Post('login')
    signIn(@Body() signInDto: Record<string, any>, @Res({ passthrough: true }) res: Response) {
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
        const user = req.user as { sub: number, username: string }
        return this.authService.getMe(user.sub);
    }
}
