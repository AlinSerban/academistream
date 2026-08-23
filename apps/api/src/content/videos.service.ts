import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Db } from "../db/client";
import { DRIZZLE } from "../db/db.module";
import type { CreateVideoInput, PublishState, UpdateVideoInput } from "./types";
import { courses, videos } from "../db/schema";
import { eq, and } from 'drizzle-orm';

@Injectable()
export class VideosService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async create(tenantId: number, input: CreateVideoInput) {
        await this.assertCourseInTenant(input.courseId, tenantId);

        const [video] = await this.db.insert(videos).values({
            tenantId,
            courseId: input.courseId,
            title: input.title,
        }).returning();

        if (!video) throw new NotFoundException();

        return video;
    }

    async update(videoId: number, input: UpdateVideoInput, tenantId: number) {
        const [updated] = await this.db
            .update(videos)
            .set({ title: input.title, updatedAt: new Date() })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning();

        if (!updated) throw new NotFoundException();
        return updated;
    }

    async publish(videoId: number, tenantId: number, publishState: PublishState) {
        const [updated] = await this.db
            .update(videos)
            .set({ publishState, updatedAt: new Date() })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning();

        if (!updated) throw new NotFoundException();
        return updated;
    }

    async getVideoById(videoId: number, tenantId: number) {
        const [video] = await this.db.select()
            .from(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .limit(1);

        if (!video) throw new NotFoundException();
        return video;
    }

    async listAll(tenantId: number) {
        return await this.db.select().from(videos).where(eq(videos.tenantId, tenantId));
    }

    async listByCourse(courseId: number, tenantId: number) {
        await this.assertCourseInTenant(courseId, tenantId);

        return await this.db.select()
            .from(videos)
            .where(and(eq(videos.courseId, courseId), eq(videos.tenantId, tenantId)));
    }

    async deleteVideo(videoId: number, tenantId: number) {
        const [deleted] = await this.db.delete(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning();

        if (!deleted) throw new NotFoundException();

        return deleted;
    }

    private async assertCourseInTenant(courseId: number, tenantId: number) {
        const [course] = await this.db.select()
            .from(courses)
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .limit(1);

        if (!course) throw new NotFoundException();
    }
}
