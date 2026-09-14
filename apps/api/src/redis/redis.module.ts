import { Global, Module, OnModuleDestroy, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { REDIS, type RedisClient } from './redis.types'

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RedisClient => {
        const url = config.get<string>('REDIS_URL')
        if (!url) {
          throw new Error('REDIS_URL is not set (required for login rate limiting)')
        }
        const client = new Redis(url, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: false,
        })
        client.on('error', (err) => {
          Logger.error(err.message, undefined, 'Redis')
        })
        return client
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name)

  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit()
    } catch (err) {
      this.logger.warn(`Redis quit: ${String(err)}`)
    }
  }
}
