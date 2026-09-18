import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Response } from 'express';
import type {
    AccessTokenResponse,
    JwtPayload,
    JwtRole,
    MeResponse,
    SignOutResponse,
} from './types';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) { }

    async signIn(
        email: string,
        password: string,
        res: Response,
    ): Promise<AccessTokenResponse> {
        const user = await this.usersService.findUser(email);
        if (!user) throw new UnauthorizedException();

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) throw new UnauthorizedException();

        const memberships = await this.usersService.findMembershipsByUserId(user.id);
        const payload = this.buildPayload(user.id, user.name, user.isPlatformAdmin, memberships);

        const refreshToken = await this.jwtService.signAsync(payload, {
            expiresIn: 60 * 60 * 24 * 7,
        });

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7 * 1000,
            path: '/',
        });

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async refresh(refreshToken: string | undefined): Promise<AccessTokenResponse> {
        if (!refreshToken) throw new UnauthorizedException();

        let validToken: JwtPayload;
        try {
            validToken = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
        } catch {
            throw new UnauthorizedException();
        }

        const user = await this.usersService.findUserById(validToken.sub);
        if (!user) throw new UnauthorizedException();

        const memberships = await this.usersService.findMembershipsByUserId(user.id);
        const payload = this.buildPayload(
            user.id,
            user.name,
            user.isPlatformAdmin,
            memberships,
        );

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async signOut(res: Response): Promise<SignOutResponse> {
        res.clearCookie('refresh_token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        return { message: 'Log out successful!' };
    }

    async getMe(userId: number): Promise<MeResponse> {
        const user = await this.usersService.findUserById(userId);
        const memberships = await this.usersService.findMembershipsByUserId(userId);
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            isPlatformAdmin: user.isPlatformAdmin,
            memberships,
        };
    }

    private buildPayload(
        userId: number,
        name: string,
        isPlatformAdmin: boolean,
        memberships: JwtRole[],
    ): JwtPayload {
        return {
            sub: userId,
            username: name,
            isPlatformAdmin,
            roles: memberships,
        };
    }
}
