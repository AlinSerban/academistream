import { NotFoundException } from '@nestjs/common'
import {
  closeDb,
  createContentIntegrationModule,
  requireSeededTenants,
} from './helpers'

describe('tenancy isolation (Postgres)', () => {
  let cleanup: (() => Promise<void>) | undefined

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = undefined
  })

  it('Acme video is not visible to Globex tenant id', async () => {
    const { module, db, courses, videos } =
      await createContentIntegrationModule()
    cleanup = async () => {
      await module.close()
      await closeDb(db)
    }

    const { acmeId, globexId } = await requireSeededTenants(db)

    const course = await courses.create(acmeId, {
      title: `Isolation course ${Date.now()}`,
    })
    const video = await videos.create(acmeId, {
      title: `Isolation video ${Date.now()}`,
      courseId: course.id,
    })

    await expect(videos.getVideoById(video.id, acmeId)).resolves.toMatchObject({
      id: video.id,
      tenantId: acmeId,
    })

    await expect(videos.getVideoById(video.id, globexId)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
