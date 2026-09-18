import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../db/db.module';
import { CoursesService } from './courses.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let db: {
    select: jest.Mock;
    insert: jest.Mock;
  };

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    service = module.get(CoursesService);
  });

  function mockSelectLimit(rows: unknown[]) {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    db.select.mockReturnValue({ from });
    return { where };
  }

  function mockSelectWhere(rows: unknown[]) {
    const where = jest.fn().mockResolvedValue(rows);
    const from = jest.fn().mockReturnValue({ where });
    db.select.mockReturnValue({ from });
    return { where };
  }

  it('create inserts with the caller tenantId', async () => {
    const created = {
      id: 1,
      tenantId: 10,
      title: 'Acme 101',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const returning = jest.fn().mockResolvedValue([created]);
    const values = jest.fn().mockReturnValue({ returning });
    db.insert.mockReturnValue({ values });

    await expect(
      service.create(10, { title: 'Acme 101' }),
    ).resolves.toEqual(created);

    expect(values).toHaveBeenCalledWith({
      tenantId: 10,
      title: 'Acme 101',
    });
  });

  it('getCourseById returns course for matching tenant', async () => {
    const course = { id: 1, tenantId: 10, title: 'Acme 101' };
    mockSelectLimit([course]);

    await expect(service.getCourseById(1, 10)).resolves.toEqual(course);
  });

  it('getCourseById throws when Globex asks for Acme course (wrong tenant)', async () => {
    mockSelectLimit([]);

    await expect(service.getCourseById(1, 20)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('list scopes to tenantId (Acme vs Globex)', async () => {
    const acmeCourses = [{ id: 1, tenantId: 10, title: 'Acme 101' }];
    const countWhere = jest.fn().mockResolvedValue([{ total: 1 }]);
    const offset = jest.fn().mockResolvedValue(acmeCourses);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const listWhere = jest.fn().mockReturnValue({ orderBy });
    const from = jest
      .fn()
      .mockReturnValueOnce({ where: countWhere })
      .mockReturnValueOnce({ where: listWhere });
    db.select.mockReturnValue({ from });

    await expect(
      service.list(10, { page: 1, pageSize: 5 }),
    ).resolves.toEqual({
      items: acmeCourses,
      total: 1,
      page: 1,
      pageSize: 5,
    });
    expect(listWhere).toHaveBeenCalled();
  });

  it('list returns empty for tenant with no courses', async () => {
    const countWhere = jest.fn().mockResolvedValue([{ total: 0 }]);
    const offset = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const listWhere = jest.fn().mockReturnValue({ orderBy });
    const from = jest
      .fn()
      .mockReturnValueOnce({ where: countWhere })
      .mockReturnValueOnce({ where: listWhere });
    db.select.mockReturnValue({ from });

    await expect(
      service.list(20, { page: 1, pageSize: 5 }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
    });
  });
});
