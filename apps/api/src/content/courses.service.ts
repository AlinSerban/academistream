import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Db } from '@academistream/db'
import { courses } from '@academistream/db'
import { DRIZZLE } from '../db/db.module'
import type { CourseOption, CreateCourseInput } from './types'
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import {
    pageOffset,
    toPageResult,
    type PageParams,
    type PageResult,
} from '../common/pagination'

const COURSE_OPTIONS_LIMIT = 200

@Injectable()
export class CoursesService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async create(tenantId: number, input: CreateCourseInput) {
        const [course] = await this.db
            .insert(courses)
            .values({
                tenantId,
                title: input.title,
            })
            .returning()

        if (!course) throw new NotFoundException()
        return course
    }

    async update(courseId: number, courseInput: CreateCourseInput, tenantId: number) {
        const [updated] = await this.db
            .update(courses)
            .set({ title: courseInput.title, updatedAt: new Date() })
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .returning()

        if (!updated) throw new NotFoundException()
        return updated
    }

    async getCourseById(courseId: number, tenantId: number) {
        const [course] = await this.db
            .select()
            .from(courses)
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .limit(1)

        if (!course) throw new NotFoundException()
        return course
    }

    async list(
        tenantId: number,
        params: PageParams,
        q?: string,
    ): Promise<PageResult<typeof courses.$inferSelect>> {
        const filters: SQL[] = [eq(courses.tenantId, tenantId)]
        const query = q?.trim()
        if (query) {
            const pattern = `%${query}%`
            const idNum = Number(query)
            filters.push(
                Number.isFinite(idNum) && String(idNum) === query
                    ? or(ilike(courses.title, pattern), eq(courses.id, idNum))!
                    : ilike(courses.title, pattern),
            )
        }
        const whereClause = and(...filters)

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(courses)
            .where(whereClause)

        const items = await this.db
            .select()
            .from(courses)
            .where(whereClause)
            .orderBy(desc(courses.id))
            .limit(params.pageSize)
            .offset(pageOffset(params))

        return toPageResult(items, Number(totalRow?.total ?? 0), params)
    }

    async listOptions(tenantId: number): Promise<CourseOption[]> {
        return this.db
            .select({
                id: courses.id,
                title: courses.title,
            })
            .from(courses)
            .where(eq(courses.tenantId, tenantId))
            .orderBy(sql`lower(${courses.title})`)
            .limit(COURSE_OPTIONS_LIMIT)
    }

    async deleteCourse(courseId: number, tenantId: number) {
        const [deleted] = await this.db
            .delete(courses)
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .returning()

        if (!deleted) throw new NotFoundException()
        return deleted
    }
}
