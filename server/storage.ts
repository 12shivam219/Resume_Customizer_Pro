import {
  users,
  resumes,
  techStacks,
  pointGroups,
  processingHistory,
  type User,
  type UpsertUser,
  type Resume,
  type InsertResume,
  type TechStack,
  type InsertTechStack,
  type PointGroup,
  type InsertPointGroup,
  type ProcessingHistory,
  type InsertProcessingHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Resume operations
  createResume(resume: InsertResume): Promise<Resume>;
  getResumesByUserId(userId: string): Promise<Resume[]>;
  getResumeById(id: string): Promise<Resume | undefined>;
  updateResumeStatus(id: string, status: string): Promise<void>;
  updateResumeContent(id: string, content: string): Promise<void>;
  deleteResume(id: string): Promise<void>;
  
  // Tech stack operations
  createTechStack(techStack: InsertTechStack): Promise<TechStack>;
  getTechStacksByResumeId(resumeId: string): Promise<TechStack[]>;
  deleteTechStacksByResumeId(resumeId: string): Promise<void>;
  
  // Point group operations
  createPointGroup(pointGroup: InsertPointGroup): Promise<PointGroup>;
  getPointGroupsByResumeId(resumeId: string): Promise<PointGroup[]>;
  deletePointGroupsByResumeId(resumeId: string): Promise<void>;
  
  // Processing history operations
  createProcessingHistory(history: InsertProcessingHistory): Promise<ProcessingHistory>;
  getProcessingHistoryByResumeId(resumeId: string): Promise<ProcessingHistory[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Resume operations
  async createResume(resume: InsertResume): Promise<Resume> {
    const [newResume] = await db.insert(resumes).values(resume).returning();
    return newResume;
  }

  async getResumesByUserId(userId: string): Promise<Resume[]> {
    return await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.uploadedAt));
  }

  async getResumeById(id: string): Promise<Resume | undefined> {
    const [resume] = await db.select().from(resumes).where(eq(resumes.id, id));
    return resume;
  }

  async updateResumeStatus(id: string, status: string): Promise<void> {
    await db
      .update(resumes)
      .set({ status, updatedAt: new Date() })
      .where(eq(resumes.id, id));
  }

  async updateResumeContent(id: string, content: string): Promise<void> {
    await db
      .update(resumes)
      .set({ customizedContent: content, updatedAt: new Date() })
      .where(eq(resumes.id, id));
  }

  async deleteResume(id: string): Promise<void> {
    await db.delete(resumes).where(eq(resumes.id, id));
  }

  // Tech stack operations
  async createTechStack(techStack: InsertTechStack): Promise<TechStack> {
    const [newTechStack] = await db.insert(techStacks).values(techStack).returning();
    return newTechStack;
  }

  async getTechStacksByResumeId(resumeId: string): Promise<TechStack[]> {
    return await db
      .select()
      .from(techStacks)
      .where(eq(techStacks.resumeId, resumeId));
  }

  async deleteTechStacksByResumeId(resumeId: string): Promise<void> {
    await db.delete(techStacks).where(eq(techStacks.resumeId, resumeId));
  }

  // Point group operations
  async createPointGroup(pointGroup: InsertPointGroup): Promise<PointGroup> {
    const [newPointGroup] = await db.insert(pointGroups).values(pointGroup).returning();
    return newPointGroup;
  }

  async getPointGroupsByResumeId(resumeId: string): Promise<PointGroup[]> {
    return await db
      .select()
      .from(pointGroups)
      .where(eq(pointGroups.resumeId, resumeId))
      .orderBy(pointGroups.createdAt);
  }

  async deletePointGroupsByResumeId(resumeId: string): Promise<void> {
    await db.delete(pointGroups).where(eq(pointGroups.resumeId, resumeId));
  }

  // Processing history operations
  async createProcessingHistory(history: InsertProcessingHistory): Promise<ProcessingHistory> {
    const [newHistory] = await db.insert(processingHistory).values(history).returning();
    return newHistory;
  }

  async getProcessingHistoryByResumeId(resumeId: string): Promise<ProcessingHistory[]> {
    return await db
      .select()
      .from(processingHistory)
      .where(eq(processingHistory.resumeId, resumeId))
      .orderBy(desc(processingHistory.createdAt));
  }
}

export const storage = new DatabaseStorage();
