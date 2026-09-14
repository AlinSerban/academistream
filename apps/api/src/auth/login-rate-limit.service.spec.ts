import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { HttpException, HttpStatus } from '@nestjs/common'
import { LoginRateLimitService } from './login-rate-limit.service'
import { REDIS } from '../redis/redis.types'

describe('LoginRateLimitService', () => {
  let service: LoginRateLimitService
  let redis: { incr: jest.Mock; pexpire: jest.Mock }

  beforeEach(async () => {
    redis = {
      incr: jest.fn(),
      pexpire: jest.fn().mockResolvedValue(1),
    }

    const module = await Test.createTestingModule({
      providers: [
        LoginRateLimitService,
        { provide: REDIS, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'LOGIN_RATE_LIMIT_WINDOW_MS') return '60000'
              if (key === 'LOGIN_RATE_LIMIT_IP_MAX') return '10'
              if (key === 'LOGIN_RATE_LIMIT_EMAIL_MAX') return '5'
              return undefined
            },
          },
        },
      ],
    }).compile()

    service = module.get(LoginRateLimitService)
  })

  it('allows requests under the limit and sets TTL on first hit', async () => {
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1)

    await expect(
      service.assertAllowed('127.0.0.1', 'a@b.com'),
    ).resolves.toBeUndefined()

    expect(redis.pexpire).toHaveBeenCalledWith('login:ip:127.0.0.1', 60000)
    expect(redis.pexpire).toHaveBeenCalledWith('login:email:a@b.com', 60000)
  })

  it('rejects when email bucket exceeds max', async () => {
    redis.incr
      .mockResolvedValueOnce(2) // ip ok
      .mockResolvedValueOnce(6) // email over 5

    await expect(
      service.assertAllowed('127.0.0.1', 'A@B.com'),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    } satisfies Partial<HttpException>)
  })
})
