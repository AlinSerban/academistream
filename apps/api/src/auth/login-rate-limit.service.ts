import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { REDIS, type RedisClient } from '../redis/redis.types'

@Injectable()
export class LoginRateLimitService {
  private readonly windowMs: number
  private readonly ipMax: number
  private readonly emailMax: number

  constructor(
    @Inject(REDIS) private readonly redis: RedisClient,
    config: ConfigService,
  ) {
    this.windowMs = this.readPositiveInt(
      config.get<string>('LOGIN_RATE_LIMIT_WINDOW_MS'),
      60_000,
    )
    this.ipMax = this.readPositiveInt(
      config.get<string>('LOGIN_RATE_LIMIT_IP_MAX'),
      10,
    )
    this.emailMax = this.readPositiveInt(
      config.get<string>('LOGIN_RATE_LIMIT_EMAIL_MAX'),
      5,
    )
  }

  async assertAllowed(ip: string, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase()
    const safeIp = ip.trim() || 'unknown'

    await Promise.all([
      this.hit(`login:ip:${safeIp}`, this.ipMax),
      this.hit(`login:email:${normalizedEmail}`, this.emailMax),
    ])
  }

  private async hit(key: string, max: number): Promise<void> {
    const count = await this.redis.incr(key)
    if (count === 1) {
      await this.redis.pexpire(key, this.windowMs)
    }
    if (count > max) {
      throw new HttpException(
        'Too many login attempts. Try again in a minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  private readPositiveInt(raw: string | undefined, fallback: number): number {
    if (raw == null || raw.trim() === '') return fallback
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return fallback
    return Math.floor(n)
  }
}
