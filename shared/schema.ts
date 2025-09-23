import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with local authentication support
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const resumes = pgTable("resumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name").notNull(),
  originalContent: text("original_content"), // Store DOCX content as text
  customizedContent: text("customized_content"), // Store edited content
  fileSize: integer("file_size").notNull(),
  status: varchar("status").notNull().default("uploaded"), // uploaded, processing, ready, customized
  downloads: integer("downloads").notNull().default(0),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // PERFORMANCE INDEXES for lightning-fast queries
  index("idx_resumes_user_id").on(table.userId),
  index("idx_resumes_status").on(table.status),
  index("idx_resumes_uploaded_at").on(table.uploadedAt),
  index("idx_resumes_user_status").on(table.userId, table.status), // Composite index for user stats
]);

export const techStacks = pgTable("tech_stacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  bulletPoints: text("bullet_points").array().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_tech_stacks_resume_id").on(table.resumeId),
]);

export const pointGroups = pgTable("point_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  points: jsonb("points").notNull(), // Array of {techStack: string, text: string}
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_point_groups_resume_id").on(table.resumeId),
]);

export const processingHistory = pgTable("processing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  input: text("input").notNull(),
  output: jsonb("output").notNull(),
  settings: jsonb("settings"), // Processing settings like points per group
  processingTime: integer("processing_time"), // in milliseconds
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_processing_history_resume_id").on(table.resumeId),
  index("idx_processing_history_created_at").on(table.createdAt),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  resumes: many(resumes),
}));

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  user: one(users, {
    fields: [resumes.userId],
    references: [users.id],
  }),
  techStacks: many(techStacks),
  pointGroups: many(pointGroups),
  processingHistory: many(processingHistory),
}));

export const techStacksRelations = relations(techStacks, ({ one }) => ({
  resume: one(resumes, {
    fields: [techStacks.resumeId],
    references: [resumes.id],
  }),
}));

export const pointGroupsRelations = relations(pointGroups, ({ one }) => ({
  resume: one(resumes, {
    fields: [pointGroups.resumeId],
    references: [resumes.id],
  }),
}));

export const processingHistoryRelations = relations(processingHistory, ({ one }) => ({
  resume: one(resumes, {
    fields: [processingHistory.resumeId],
    references: [resumes.id],
  }),
}));

// Insert schemas
export const insertResumeSchema = createInsertSchema(resumes).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
});

export const insertTechStackSchema = createInsertSchema(techStacks).omit({
  id: true,
  createdAt: true,
});

export const insertPointGroupSchema = createInsertSchema(pointGroups).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingHistorySchema = createInsertSchema(processingHistory).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type TechStack = typeof techStacks.$inferSelect;
export type InsertTechStack = z.infer<typeof insertTechStackSchema>;
export type PointGroup = typeof pointGroups.$inferSelect;
export type InsertPointGroup = z.infer<typeof insertPointGroupSchema>;
export type ProcessingHistory = typeof processingHistory.$inferSelect;
export type InsertProcessingHistory = z.infer<typeof insertProcessingHistorySchema>;

// Point structure for groups
export type Point = {
  techStack: string;
  text: string;
};
