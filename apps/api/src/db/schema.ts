import { integer, varchar, timestamp, boolean, pgTable, pgEnum, unique, index } from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);
export const membershipRoles = pgEnum('membership_role', ['tenant_admin', 'instructor', 'learner']);

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