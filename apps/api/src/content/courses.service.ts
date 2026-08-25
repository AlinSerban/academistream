import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Db } from "@academistream/db";
import { courses } from "@academistream/db";
import { DRIZZLE } from "../db/db.module";
import type { CreateCourseInput } from "./types";
import { eq, and } from 'drizzle-orm';

@Injectable()
export class CoursesService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async create(tenantId: number, input: CreateCourseInput) {
        const [course] = await this.db.insert(courses).values({
            tenantId,
            title: input.title
        }).returning();

        if (!course) throw new NotFoundException();

        return course;
    }


    async update(courseId: number, courseInput: CreateCourseInput, tenantId: number) {

        const [updated] = await this.db
            .update(courses)
            .set({ title: courseInput.title, updatedAt: new Date() })
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .returning();

        if (!updated) throw new NotFoundException();
        return updated;
    }

    async getCourseById(courseId: number, tenantId: number) {
        const [course] = await this.db.select().
            from(courses)
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId))).limit(1);

        if (!course) throw new NotFoundException();
        return course;
    }

    async listAll(tenantId: number) {
        return await this.db.select().from(courses).where(eq(courses.tenantId, tenantId));
    }

    async deleteCourse(courseId: number, tenantId: number) {
        const [deleted] = await
            this.db.delete(courses)
                .where(and(eq(courses.id, courseId),
                    eq(courses.tenantId, tenantId)))
                .returning();

        if (!deleted) throw new NotFoundException();

        return deleted;
    }

}