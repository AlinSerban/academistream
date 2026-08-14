import { integer, varchar, timestamp, pgTable } from "drizzle-orm/pg-core";

export const healthChecks = pgTable('health_checks', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    labels: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
})