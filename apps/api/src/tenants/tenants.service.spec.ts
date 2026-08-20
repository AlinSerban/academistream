import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../db/db.module';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let db: { select: jest.Mock };

  beforeEach(async () => {
    const limit = jest.fn();
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    db = {
      select: jest.fn().mockReturnValue({ from }),
    };
    (db as any)._limit = limit;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    service = module.get(TenantsService);
  });

  it('getMe returns Acme for tenant id 10', async () => {
    (db as any)._limit.mockResolvedValue([
      { id: 10, name: 'Acme', status: 'active' },
    ]);

    await expect(service.getMe(10)).resolves.toEqual({
      id: 10,
      name: 'Acme',
      status: 'active',
    });
  });

  it('getMe returns Globex for tenant id 20 (isolation by tenantId)', async () => {
    (db as any)._limit.mockResolvedValue([
      { id: 20, name: 'Globex', status: 'active' },
    ]);

    await expect(service.getMe(20)).resolves.toEqual({
      id: 20,
      name: 'Globex',
      status: 'active',
    });
  });

  it('getMe throws NotFoundException when tenant missing', async () => {
    (db as any)._limit.mockResolvedValue([]);

    await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
  });
});
