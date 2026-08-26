import { Inject, Injectable } from '@nestjs/common'
import type { Db } from '@academistream/db'
import { completions, users, videos } from '@academistream/db'
import { eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'

@Injectable()
export class CompletionsExportService {
    constructor(@Inject(DRIZZLE) private readonly db: Db) { }

    async toCsv(tenantId: number): Promise<string> {
        const rows = await this.db
            .select({
                userId: completions.userId,
                email: users.email,
                name: users.name,
                videoId: completions.videoId,
                videoTitle: videos.title,
                completedAt: completions.completedAt,
            })
            .from(completions)
            .innerJoin(users, eq(users.id, completions.userId))
            .innerJoin(videos, eq(videos.id, completions.videoId))
            .where(eq(completions.tenantId, tenantId))

        const header = [
            'userId',
            'email',
            'name',
            'videoId',
            'videoTitle',
            'completedAt',
        ]
        const lines = [header.join(',')]
        for (const row of rows) {
            lines.push(
                [
                    row.userId,
                    csvEscape(row.email),
                    csvEscape(row.name),
                    row.videoId,
                    csvEscape(row.videoTitle),
                    row.completedAt.toISOString(),
                ].join(','),
            )
        }
        return lines.join('\n') + '\n'
    }
}

function csvEscape(value: string): string {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}
