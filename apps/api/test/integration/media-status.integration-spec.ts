import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { videos } from '@academistream/db'
import {
  closeDb,
  createContentIntegrationModule,
  fakeUploadFile,
  requireSeededTenants,
} from './helpers'

describe('media status path (Postgres, Kafka mocked)', () => {
  let cleanup: (() => Promise<void>) | undefined

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = undefined
  })

  it('upload queues media; simulated worker ready allows playback when published', async () => {
    const { module, db, courses, videos: videosService, kafka } =
      await createContentIntegrationModule()
    cleanup = async () => {
      await module.close()
      await closeDb(db)
    }

    const { acmeId, globexId, acmeInstructorId } =
      await requireSeededTenants(db)

    const course = await courses.create(acmeId, {
      title: `Media course ${Date.now()}`,
    })
    const created = await videosService.create(acmeId, {
      title: `Media video ${Date.now()}`,
      courseId: course.id,
    })

    expect(created.mediaStatus).toBe('queued')

    const afterUpload = await videosService.uploadVideo(
      created.id,
      acmeId,
      fakeUploadFile(),
    )

    expect(afterUpload.mediaStatus).toBe('queued')
    expect(afterUpload.storageKey).toBe(
      `tenants/${acmeId}/videos/${created.id}/source.mp4`,
    )
    expect(kafka.sendVideoProcessingJob).toHaveBeenCalledWith({
      videoId: created.id,
      tenantId: acmeId,
      storageKey: afterUpload.storageKey,
      action: 'process',
    })

    // Simulate local worker completion without Kafka/MediaConvert.
    await db
      .update(videos)
      .set({
        mediaStatus: 'ready',
        playbackKey: afterUpload.storageKey,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, created.id))

    await expect(
      videosService.getPlaybackUrl(created.id, acmeId, 'instructor'),
    ).resolves.toMatchObject({
      url: expect.any(String),
      expiresIn: 3600,
    })

    await expect(
      videosService.getPlaybackUrl(created.id, acmeId, 'learner'),
    ).rejects.toBeInstanceOf(ForbiddenException)

    await videosService.publish(created.id, acmeId, 'published', acmeInstructorId)

    await expect(
      videosService.getPlaybackUrl(created.id, acmeId, 'learner'),
    ).resolves.toMatchObject({
      url: expect.any(String),
    })

    await expect(
      videosService.getPlaybackUrl(created.id, globexId, 'instructor'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
