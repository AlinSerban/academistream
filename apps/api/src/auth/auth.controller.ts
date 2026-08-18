import { Body, Controller, HttpCode, HttpStatus, Post, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    signIn(@Body() signInDto: Record<string, any>, @Res({ passthrough: true }) res: Response) {
        return this.authService.signIn(signInDto.email, signInDto.password, res);
    }

    @Post('refresh')
    refresh(@Req() req: Request) {
        return this.authService.refresh(req.cookies?.refresh_token);
    }

    @Post('logout')
    logOut(@Res({ passthrough: true }) res: Response) {
        return this.authService.signOut(res);
    }
}
