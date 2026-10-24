import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull(),
  mood: text("mood").notNull(),
  note: text("note").notNull(),
  time: text("time"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const loginAttempts = sqliteTable("login_attempts", {
  clientKey: text("client_key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
});
