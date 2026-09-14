import { Test, type TestingModule } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import cookieParser from 'cookie-parser'
import { tenants, videos, type Db } from '@academistream/db'
import { AppModule } from '../src/app.module'
import { KafkaProducerService } from '../src/kafka/kafka.producer'
import { DRIZZLE } from '../src/db/db.module'
import { REDIS, type RedisClient } from '../src/redis/redis.types'
import { closeDb } from './integration/helpers'

/**
 * Thin demo-script e2e over HTTP.
 * Kafka is mocked so CI does not need brokers; Postgres + Redis required.
 */
describe('Demo script (HTTP)', () => {
  let app: INestApplication
  let moduleRef: TestingModule
  let db: Db
  let redis: RedisClient
  let kafkaSend: jest.Mock

  beforeAll(async () => {
    kafkaSend = jest.fn().mockResolvedValue(undefined)

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KafkaProducerService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
        sendVideoProcessingJob: kafkaSend,
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    await app.init()
    db = moduleRef.get(DRIZZLE)
    redis = moduleRef.get(REDIS)

    await db
      .update(tenants)
      .set({ maxUsers: 1000, maxVideos: 1000, updatedAt: new Date() })
  })

  afterAll(async () => {
    await app.close()
    try {
      await redis.quit()
    } catch {
      // already closed
    }
    await closeDb(db)
  })

  async function login(email: string, password = 'Password123!') {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200)

    expect(res.body.access_token).toEqual(expect.any(String))
    return res.body.access_token as string
  }

  it('instructor upload → ready → publish → learner play; Globex isolated', async () => {
    const instructorToken = await login('instructor@acme.local')

    const courseRes = await request(app.getHttpServer())
      .post('/courses/create')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ title: `Demo e2e course ${Date.now()}` })
      .expect(201)

    const courseId = courseRes.body.id as number

    const videoRes = await request(app.getHttpServer())
      .post('/videos/create')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ title: `Demo e2e video ${Date.now()}`, courseId })
      .expect(201)

    const videoId = videoRes.body.id as number
    expect(videoRes.body.mediaStatus).toBe('queued')

    await request(app.getHttpServer())
      .post(`/videos/${videoId}/upload`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .attach('file', Buffer.from('demo-e2e-bytes'), {
        filename: 'demo.mp4',
        contentType: 'video/mp4',
      })
      .expect(201)

    expect(kafkaSend).toHaveBeenCalled()

    const [row] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1)

    expect(row?.storageKey).toBeTruthy()

    await db
      .update(videos)
      .set({
        mediaStatus: 'ready',
        playbackKey: row!.storageKey,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId))

    await request(app.getHttpServer())
      .patch(`/videos/${videoId}/publish`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ publishState: 'published' })
      .expect(200)

    const learnerToken = await login('learner@acme.local')
    const playback = await request(app.getHttpServer())
      .get(`/videos/${videoId}/playback`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .expect(200)

    expect(playback.body.url).toEqual(expect.any(String))

    const globexToken = await login('admin@globex.local')
    await request(app.getHttpServer())
      .get(`/videos/${videoId}`)
      .set('Authorization', `Bearer ${globexToken}`)
      .expect(404)
  })
})
