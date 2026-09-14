import { Test, type TestingModule } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { tenants, users, type Db } from '@academistream/db'
import { DbModule, DRIZZLE } from '../../src/db/db.module'
import { StorageModule } from '../../src/storage/storage.module'
import { AuditModule } from '../../src/audit/audit.module'
import { QuotasModule } from '../../src/quotas/quotas.module'
import { CoursesService } from '../../src/content/courses.service'
import { VideosService } from '../../src/content/videos.service'
import { KafkaProducerService } from '../../src/kafka/kafka.producer'

export type SeededTenants = {
  acmeId: number
  globexId: number
  acmeInstructorId: number
}

export async function createContentIntegrationModule(): Promise<{
  module: TestingModule
  db: Db
  courses: CoursesService
  videos: VideosService
  kafka: { sendVideoProcessingJob: jest.Mock }
}> {
  const kafka = {
    sendVideoProcessingJob: jest.fn().mockResolvedValue(undefined),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  }

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['.env', '../../.env'],
      }),
      DbModule,
      StorageModule,
      AuditModule,
      QuotasModule,
    ],
    providers: [
      CoursesService,
      VideosService,
      { provide: KafkaProducerService, useValue: kafka },
    ],
  }).compile()

  return {
    module,
    db: module.get(DRIZZLE),
    courses: module.get(CoursesService),
    videos: module.get(VideosService),
    kafka,
  }
}

export async function requireSeededTenants(db: Db): Promise<SeededTenants> {
  const [acme] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, 'Acme'))
    .limit(1)
  const [globex] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, 'Globex'))
    .limit(1)
  const [instructor] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'instructor@acme.local'))
    .limit(1)

  if (!acme || !globex || !instructor) {
    throw new Error(
      'Seed data missing. Run: npm run db:migrate && npm run db:seed',
    )
  }

  // Demo seed caps are intentionally tight; raise them for integration runs.
  await db
    .update(tenants)
    .set({
      maxUsers: 1000,
      maxVideos: 1000,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, acme.id))
  await db
    .update(tenants)
    .set({
      maxUsers: 1000,
      maxVideos: 1000,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, globex.id))

  return {
    acmeId: acme.id,
    globexId: globex.id,
    acmeInstructorId: instructor.id,
  }
}

export async function closeDb(db: Db): Promise<void> {
  const client = (db as unknown as { $client?: { end: () => Promise<void> } })
    .$client
  if (client) await client.end()
}

export function fakeUploadFile(
  contents = 'fake-mp4-bytes',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'clip.mp4',
    encoding: '7bit',
    mimetype: 'video/mp4',
    size: contents.length,
    buffer: Buffer.from(contents),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
  }
}
