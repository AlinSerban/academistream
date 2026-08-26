import { integer, varchar, timestamp, boolean, pgTable, pgEnum, unique, index } from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);
export const membershipRoles = pgEnum('membership_role', ['tenant_admin', 'instructor', 'learner']);
export const publishStateEnum = pgEnum('publish_state', ['draft', 'published']);
export const mediaStatusEnum = pgEnum('media_status', ['queued', 'processing', 'ready', 'failed']);

export const healthChecks = pgTable('health_checks', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    labels: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const tenants = pgTable('tenants', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    status: tenantStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const users = pgTable('users', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const tenantMemberships = pgTable('tenant_memberships', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
        .notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: integer('tenant_id')
        .notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    role: membershipRoles('role').notNull()
},
    (t) => [
        unique().on(t.userId, t.tenantId),
        index('tenant_memberships_tenant_id_idx').on(t.tenantId)
    ]
);

export const courses = pgTable('courses', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id')
        .notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    title: varchar({ length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (t) => [
    index('courses_tenant_id_idx').on(t.tenantId)
])

export const videos = pgTable('videos', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    title: varchar({ length: 255 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }),
    publishState: publishStateEnum('publish_state').default('draft').notNull(),
    mediaStatus: mediaStatusEnum('media_status').default('queued').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
    index('videos_tenant_id_idx').on(t.tenantId),
    index('videos_course_id_idx').on(t.courseId),
])

/** Primary assignment target: a video in the tenant (S3 / E06). */
export const assignments = pgTable('assignments', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    videoId: integer('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assignedByUserId: integer('assigned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    unique().on(t.tenantId, t.videoId, t.userId),
    index('assignments_tenant_id_idx').on(t.tenantId),
    index('assignments_user_id_idx').on(t.userId),
])

export const watchProgress = pgTable('watch_progress', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    videoId: integer('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    positionSeconds: integer('position_seconds').notNull().default(0),
    percent: integer('percent').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
    unique().on(t.tenantId, t.userId, t.videoId),
    index('watch_progress_tenant_id_idx').on(t.tenantId),
])

export const completions = pgTable('completions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    videoId: integer('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (t) => [
    unique().on(t.tenantId, t.userId, t.videoId),
    index('completions_tenant_id_idx').on(t.tenantId),
])
