import { integer, varchar, timestamp, boolean, pgTable, pgEnum, unique, index, text } from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);
export const membershipRoles = pgEnum('membership_role', ['tenant_admin', 'instructor', 'learner']);
export const publishStateEnum = pgEnum('publish_state', ['draft', 'published']);
export const mediaStatusEnum = pgEnum('media_status', ['queued', 'processing', 'ready', 'failed']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'revoked']);

export const healthChecks = pgTable('health_checks', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    labels: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
})

export const tenants = pgTable('tenants', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    status: tenantStatusEnum('status').notNull().default('active'),
    /** Null = unlimited (S5 / E10). */
    maxUsers: integer('max_users'),
    /** Null = unlimited (S5 / E10). */
    maxVideos: integer('max_videos'),
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
    /** Transcoded output key for playback (S6-04); local path mirrors storageKey. */
    playbackKey: varchar('playback_key', { length: 512 }),
    /** AWS MediaConvert job id while transcoding (S6-03); cleared or kept after S6-04 completion. */
    mediaConvertJobId: varchar('mediaconvert_job_id', { length: 64 }),
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

export const auditEvents = pgTable('audit_events', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar({ length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }),
    entityId: integer('entity_id'),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    index('audit_events_tenant_id_idx').on(t.tenantId),
    index('audit_events_created_at_idx').on(t.createdAt),
])

export const invites = pgTable('invites', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar({ length: 255 }).notNull(),
    role: membershipRoles('role').notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    status: inviteStatusEnum('status').notNull().default('pending'),
    invitedByUserId: integer('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    index('invites_tenant_id_idx').on(t.tenantId),
    index('invites_email_idx').on(t.email),
])

export const notifications = pgTable('notifications', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar({ length: 100 }).notNull(),
    title: varchar({ length: 255 }),
    body: text('body'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    index('notifications_tenant_user_idx').on(t.tenantId, t.userId),
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_created_at_idx').on(t.createdAt),
])
