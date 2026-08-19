import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Response } from 'express';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) { }

    async signIn(email: string, pass: string, res: Response): Promise<any> {

        const user = await this.usersService.findUser(email);
        if (!user)
            throw new UnauthorizedException();

        const passwordMatch = await bcrypt.compare(pass, user.passwordHash);
        if (!passwordMatch) {
            throw new UnauthorizedException();
        }

        const memberships = await this.usersService.findMembershipsByUserId(user.id);

        const payload = {
            sub: user?.id,
            username: user?.name,
            isPlatformAdmin: user.isPlatformAdmin,
            roles: memberships
        };

        const refresh_token = await this.jwtService.signAsync(payload, {
            expiresIn: 60 * 60 * 24 * 7
        })

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7 * 1000,
            path: '/',
        })
        return {
            access_token: await this.jwtService.signAsync(payload),
        }

    }

    async refresh(refreshToken: string) {
        const refresh_token = refreshToken;
        let validToken;
        if (!refresh_token)
            throw new UnauthorizedException();

        try {
            validToken = await this.jwtService.verifyAsync(refresh_token);
        }
        catch (err) {
            throw new UnauthorizedException();
        }

        const payload = { sub: validToken.sub, username: validToken.username }

        return {
            access_token: await this.jwtService.signAsync(payload, { expiresIn: '60s' })

        }

    }

    async signOut(res: Response) {
        res.clearCookie('refresh_token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return { message: 'Log out successful!' }
    }

    async getMe(userId: number) {
        const user = await this.usersService.findUserById(userId);
        const memberships = await this.usersService.findMembershipsByUserId(userId);
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            isPlatformAdmin: user.isPlatformAdmin,
            memberships: memberships
        };
    }

}
