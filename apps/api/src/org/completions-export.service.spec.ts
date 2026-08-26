import { Test, TestingModule } from '@nestjs/testing'
import { DRIZZLE } from '../db/db.module'
import { CompletionsExportService } from './completions-export.service'

describe('CompletionsExportService', () => {
  let service: CompletionsExportService
  let db: { select: jest.Mock }

  beforeEach(async () => {
    db = { select: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletionsExportService,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile()

    service = module.get(CompletionsExportService)
  })

  it('toCsv returns header-only when tenant has no completions', async () => {
    const where = jest.fn().mockResolvedValue([])
    const innerJoin2 = jest.fn().mockReturnValue({ where })
    const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 })
    const from = jest.fn().mockReturnValue({ innerJoin: innerJoin1 })
    db.select.mockReturnValue({ from })

    const csv = await service.toCsv(10)
    expect(csv).toBe(
      'userId,email,name,videoId,videoTitle,completedAt\n',
    )
    expect(where).toHaveBeenCalled()
  })

  it('toCsv includes tenant rows and escapes commas', async () => {
    const completedAt = new Date('2026-08-01T12:00:00.000Z')
    const where = jest.fn().mockResolvedValue([
      {
        userId: 4,
        email: 'a@acme.test',
        name: 'Ada, Admin',
        videoId: 3,
        videoTitle: 'Safety, Intro',
        completedAt,
      },
    ])
    const innerJoin2 = jest.fn().mockReturnValue({ where })
    const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 })
    const from = jest.fn().mockReturnValue({ innerJoin: innerJoin1 })
    db.select.mockReturnValue({ from })

    const csv = await service.toCsv(10)
    expect(csv).toContain('"Ada, Admin"')
    expect(csv).toContain('"Safety, Intro"')
    expect(csv).toContain('2026-08-01T12:00:00.000Z')
    // scoped via where(eq(completions.tenantId, tenantId)) — one where call
    expect(where).toHaveBeenCalledTimes(1)
  })
})
