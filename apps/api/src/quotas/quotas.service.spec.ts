import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DRIZZLE } from '../db/db.module'
import { QuotasService } from './quotas.service'

describe('QuotasService', () => {
  let service: QuotasService
  let db: { select: jest.Mock; update: jest.Mock }

  beforeEach(async () => {
    db = { select: jest.fn(), update: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [QuotasService, { provide: DRIZZLE, useValue: db }],
    }).compile()

    service = module.get(QuotasService)
  })

  function mockTenantLimits(
    maxUsers: number | null,
    maxVideos: number | null,
  ) {
    const limit = jest.fn().mockResolvedValue([
      { maxUsers, maxVideos },
    ])
    const where = jest.fn().mockReturnValue({ limit })
    const from = jest.fn().mockReturnValue({ where })
    return { from, where, limit }
  }

  function mockCount(value: number) {
    const where = jest.fn().mockResolvedValue([{ value }])
    const from = jest.fn().mockReturnValue({ where })
    return { from, where }
  }

  it('assertCanAddMember allows when maxUsers is null (unlimited)', async () => {
    const tenant = mockTenantLimits(null, null)
    db.select.mockReturnValueOnce(tenant)

    await expect(service.assertCanAddMember(10)).resolves.toBeUndefined()
    expect(db.select).toHaveBeenCalledTimes(1)
  })

  it('assertCanAddMember rejects when at user limit', async () => {
    const tenant = mockTenantLimits(2, null)
    const members = mockCount(2)
    db.select
      .mockReturnValueOnce(tenant)
      .mockReturnValueOnce(members)

    await expect(service.assertCanAddMember(10)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('assertCanAddVideo rejects when at video limit', async () => {
    const tenant = mockTenantLimits(null, 1)
    const videos = mockCount(1)
    db.select
      .mockReturnValueOnce(tenant)
      .mockReturnValueOnce(videos)

    await expect(service.assertCanAddVideo(10)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('getStatusForTenant scopes usage to tenantId', async () => {
    const tenant = mockTenantLimits(100, 50)
    const members = mockCount(3)
    const videoCount = mockCount(7)
    db.select
      .mockReturnValueOnce(tenant)
      .mockReturnValueOnce(members)
      .mockReturnValueOnce(videoCount)

    await expect(service.getStatusForTenant(10)).resolves.toEqual({
      tenantId: 10,
      limits: { maxUsers: 100, maxVideos: 50 },
      usage: { members: 3, videos: 7 },
    })
  })

  it('updateLimits throws when tenant missing', async () => {
    const limit = jest.fn().mockResolvedValue([])
    const where = jest.fn().mockReturnValue({ limit })
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })

    await expect(
      service.updateLimits(99, { maxUsers: 10 }),
    ).rejects.toThrow(NotFoundException)
  })
})
