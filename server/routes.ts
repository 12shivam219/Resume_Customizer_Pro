import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, hashPassword } from "./localAuth";
import { insertResumeSchema, insertTechStackSchema, insertPointGroupSchema, insertProcessingHistorySchema, type Point } from "@shared/schema";
import { DocxProcessor } from "./docx-processor";
import multer from "multer";
import { z } from "zod";

// Helper functions for tech stack processing
interface TechStackData {
  name: string;
  bulletPoints: string[];
}

function parseTechStackInputOptimized(input: string): TechStackData[] {
  const techStacks: TechStackData[] = [];
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  
  let currentTechStack: TechStackData | null = null;
  
  for (const line of lines) {
    if (!line.startsWith('•')) {
      // This is a tech stack name
      if (currentTechStack) {
        techStacks.push(currentTechStack);
      }
      currentTechStack = {
        name: line,
        bulletPoints: []
      };
    } else if (currentTechStack) {
      // This is a bullet point
      currentTechStack.bulletPoints.push(line.substring(1).trim());
    }
  }
  
  if (currentTechStack) {
    techStacks.push(currentTechStack);
  }
  
  return techStacks;
}

function generatePointGroupsAuto(techStacks: TechStackData[]): Point[][] {
  // Flatten all points with their tech stack names
  const allPoints: Point[] = techStacks.flatMap(ts => 
    ts.bulletPoints.map(point => ({
      techStack: ts.name,
      text: point
    }))
  );
  
  // Calculate optimal group size based on total points
  const totalPoints = allPoints.length;
  let optimalGroupSize: number;
  
  if (totalPoints <= 12) {
    // For small datasets, use 4 points per group
    optimalGroupSize = 4;
  } else if (totalPoints <= 24) {
    // For medium datasets, use 5-6 points per group
    optimalGroupSize = 5;
  } else {
    // For large datasets, use 6-7 points per group
    optimalGroupSize = 6;
  }
  
  // Ensure we don't have tiny groups at the end
  const numGroups = Math.ceil(totalPoints / optimalGroupSize);
  const adjustedGroupSize = Math.ceil(totalPoints / numGroups);
  
  // ...existing code...
  
  // Sort points by tech stack for even distribution across groups
  allPoints.sort((a, b) => a.techStack.localeCompare(b.techStack));
  
  // Distribute points evenly across groups using round-robin
  const groups: Point[][] = Array.from({ length: numGroups }, () => []);
  
  allPoints.forEach((point, index) => {
    const groupIndex = index % numGroups;
    groups[groupIndex].push(point);
  });
  
  // Filter out empty groups and ensure all groups have at least 3 points
  const validGroups = groups.filter(group => group.length >= 3);
  
  // ...existing code...
  return validGroups;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only DOCX files are allowed'));
    }
  },
});

// Validation schemas for auto-processing
const techStackInputSchema = z.object({
  input: z.string().min(1, "Tech stack input is required"),
});

const resumeContentSchema = z.object({
  content: z.string().min(1, "Content is required"),
});

const bulkProcessingSchema = z.object({
  resumeIds: z.array(z.string().uuid("Invalid resume ID format")).min(1, "At least one resume ID required"),
  input: z.string().min(1, "Tech stack input is required"),
});

const bulkExportSchema = z.object({
  resumeIds: z.array(z.string().uuid("Invalid resume ID format")).min(1, "At least one resume ID required"),
  format: z.enum(['docx']).optional().default('docx'),
});

const bulkSaveSchema = z.object({
  updates: z.array(z.object({
    resumeId: z.string().uuid("Invalid resume ID format"),
    content: z.string().min(1, "Content is required"),
  })).min(1, "At least one update required"),
});

const exportOptionsSchema = z.object({
  content: z.string().optional(),
  options: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    margins: z.object({
      top: z.number().optional(),
      bottom: z.number().optional(),
      left: z.number().optional(),
      right: z.number().optional(),
    }).optional(),
  }).optional(),
});

const authSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Standardized logging helper
function logRequest(method: string, path: string, userId?: string, extra?: any) {
  const timestamp = new Date().toISOString();
  const userInfo = userId ? ` - User: ${userId}` : '';
  const extraInfo = extra ? ` - ${JSON.stringify(extra)}` : '';
  console.log(`🔍 [${timestamp}] ${method} ${path}${userInfo}${extraInfo}`);
}

function logSuccess(operation: string, details?: any) {
  const detailsInfo = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`✅ ${operation}${detailsInfo}`);
}

function logError(operation: string, error: any, context?: any) {
  const contextInfo = context ? ` - Context: ${JSON.stringify(context)}` : '';
  console.error(`💥 ${operation} failed:`, error, contextInfo);
}

// Helper function to verify resume ownership
async function verifyResumeOwnership(resumeId: string, userId: string) {
  const resume = await storage.getResumeById(resumeId);
  
  if (!resume) {
    return { error: { status: 404, message: "Resume not found" } };
  }
  
  if (resume.userId !== userId) {
    return { error: { status: 403, message: "Access denied" } };
  }
  
  return { resume };
}

// Helper function for bulk resume ownership verification
async function verifyBulkResumeOwnership(resumeIds: string[], userId: string) {
  const resumeChecks = await Promise.all(
    resumeIds.map(async (id: string, index: number) => {
      logRequest('VERIFY', `/resumes/${id}`, userId, { index: index + 1, total: resumeIds.length });
      const resume = await storage.getResumeById(id);
      if (!resume) {
        logError('Resume verification', `Resume not found: ${id}`);
        return null;
      }
      if (resume.userId !== userId) {
        logError('Resume verification', `Access denied to resume ${id}`, { owner: resume.userId, requestor: userId });
        return null;
      }
      logSuccess(`Resume ${id} verified`);
      return resume;
    })
  );
  
  const validResumes = resumeChecks.filter(Boolean);
  
  if (validResumes.length !== resumeIds.length) {
    const invalidResumes = resumeIds.filter((id, index) => !resumeChecks[index]);
    return {
      error: {
        status: 403,
        message: "Access denied to some resumes",
        invalidResumes,
        details: "Some resumes were not found or you don't have permission to access them"
      }
    };
  }
  
  return { validResumes };
}

// Helper function for standard error responses
function handleValidationError(error: z.ZodError, res: any) {
  return res.status(400).json({
    message: "Invalid request data",
    errors: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }))
  });
}

// Helper function for standard server error responses
function handleServerError(error: any, operation: string, res: any, context?: any) {
  logError(operation, error, context);
  return res.status(500).json({
    message: `Failed to ${operation.toLowerCase()}`,
    error: error instanceof Error ? error.message : "Unknown error"
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info.message || 'Invalid credentials' });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      logRequest('POST', '/api/auth/register');
      
      const { email, password } = authSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        logError('Registration', 'Email already registered', { email });
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser(email, hashedPassword);
      
      req.logIn(user, (err) => {
        if (err) throw err;
        logSuccess('User registration and login', { userId: user.id, email: user.email });
        res.json(user);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleServerError(error, 'Register user', res);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.session) {
      req.logout(() => {
        req.session!.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).json({ message: 'Failed to complete logout' });
          }
          res.clearCookie('connect.sid'); // Clear the session cookie
          res.json({ message: 'Logged out successfully' });
        });
      });
    } else {
      res.json({ message: 'Already logged out' });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User Stats route
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log('Routes: Fetching stats for user:', req.user.id);
      const stats = await storage.getUserStats(req.user.id);
      
      if (!stats) {
        return res.status(404).json({ message: "Stats not found" });
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ 
        message: "Failed to fetch user stats",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Resume routes
  app.get('/api/resumes', isAuthenticated, async (req: any, res) => {
    try {
      console.log('Fetching resumes for user session:', req.user);
      const userId = req.user.id;
      
      if (!userId) {
        console.error('No user ID in session:', req.user);
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log('Fetching resumes for userId:', userId);
      const resumes = await storage.getResumesByUserId(userId);
      console.log('Found resumes:', resumes.length);

      res.json(resumes);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      // Add more detailed error information
      res.status(500).json({ 
        message: "Failed to fetch resumes",
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
    }
  });

  app.get('/api/resumes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const resume = await storage.getResumeById(id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume (FIXED: Use consistent user ID)
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(resume);
    } catch (error) {
      console.error("Error fetching resume:", error);
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });

  app.post('/api/resumes/upload', isAuthenticated, upload.array('files'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const startTime = Date.now();
      console.log(`⚡ ULTRA-FAST upload started: ${files.length} files`);
      
      // EXTREME PERFORMANCE: Process files in parallel with DOCX content extraction
      const uploadPromises = files.map(async (file, index) => {
        const fileStartTime = Date.now();
        
        // Extract actual content from DOCX file
        let extractedContent: string = '';
        let originalContent: string = '';
        
        try {
          // Validate and parse DOCX
          const isValidDocx = await DocxProcessor.validateDocx(file.buffer);
          if (!isValidDocx) {
            throw new Error(`Invalid DOCX file: ${file.originalname}`);
          }
          
          // Extract HTML content from DOCX
          const docxResult = await DocxProcessor.parseDocx(file.buffer);
          extractedContent = docxResult.html;
          
          console.log(`📄 Extracted ${docxResult.metadata.wordCount} words from ${file.originalname}`);
          
          // Still store base64 for backup/original file access
          const chunkSize = 1024 * 1024; // 1MB chunks
          const chunks: string[] = [];
          let offset = 0;
          
          while (offset < file.buffer.length) {
            const chunk = file.buffer.subarray(offset, Math.min(offset + chunkSize, file.buffer.length));
            chunks.push(chunk.toString('base64'));
            offset += chunkSize;
          }
          originalContent = chunks.join('');
          
        } catch (error) {
          console.error(`Failed to process DOCX ${file.originalname}:`, error);
          // Fallback to base64 storage if DOCX processing fails
          originalContent = file.buffer.toString('base64');
        }
        
        const resumeData = insertResumeSchema.parse({
          userId,
          fileName: file.originalname,
          originalContent,
          customizedContent: extractedContent || null, // Store extracted HTML content
          fileSize: file.size,
          status: extractedContent ? "ready" : "uploaded", // Set to ready if content extracted
        });

        const resume = await storage.createResume(resumeData);
        const fileTime = Date.now() - fileStartTime;
        console.log(`⚡ File ${index + 1}/${files.length} done in ${fileTime}ms: ${file.originalname}`);
        
        return resume;
      });
      
      const uploadedResumes = await Promise.all(uploadPromises);
      const totalTime = Date.now() - startTime;
      
      console.log(`🚀 ULTRA-FAST upload completed: ${files.length} files in ${totalTime}ms (avg: ${Math.round(totalTime/files.length)}ms/file)`);
      res.json(uploadedResumes);
      
    } catch (error) {
      console.error("💥 Upload failed:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to upload resumes" 
      });
    }
  });

  app.patch('/api/resumes/:id/content', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Validate request body
      const { content } = resumeContentSchema.parse(req.body);
      
      // Verify resume ownership
      const ownershipResult = await verifyResumeOwnership(id, userId);
      if (ownershipResult.error) {
        return res.status(ownershipResult.error.status).json({ message: ownershipResult.error.message });
      }

      await storage.updateResumeContent(id, content);
      await storage.updateResumeStatus(id, "customized");
      
      console.log(`✅ Updated content for resume: ${id}`);
      res.json({ message: "Resume content updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("💥 Error updating resume content:", error);
      res.status(500).json({ message: "Failed to update resume content" });
    }
  });

  app.delete('/api/resumes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const resume = await storage.getResumeById(id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume
      if (!req.user?.id || resume.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteResume(id);
      res.json({ message: "Resume deleted successfully" });
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({ 
        message: "Failed to delete resume",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // BULK OPERATIONS: Process multiple resumes with same tech stack input
  // NOTE: This route MUST come BEFORE the individual processing route to avoid route conflicts
  app.post('/api/resumes/bulk/process-tech-stack', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      logRequest('POST', '/api/resumes/bulk/process-tech-stack', userId);
      
      // Validate request body
      const { resumeIds, input } = bulkProcessingSchema.parse(req.body);
      
      const startTime = Date.now();
      logSuccess(`Starting bulk processing for ${resumeIds.length} resumes`);
      
      // Verify user owns all resumes
      const ownershipResult = await verifyBulkResumeOwnership(resumeIds, userId);
      if (ownershipResult.error) {
        return res.status(ownershipResult.error.status).json(ownershipResult.error);
      }
      
      // Process all resumes in parallel
      const processingPromises = resumeIds.map(async (resumeId: string) => {
        try {
          // Parse tech stack input with optimized algorithm
          const techStacksData = parseTechStackInputOptimized(input);
          
          // Clear existing data
          await Promise.all([
            storage.deleteTechStacksByResumeId(resumeId),
            storage.deletePointGroupsByResumeId(resumeId)
          ]);
          
          // Prepare batch data for tech stacks
          const techStacksBatchData = techStacksData.map(techStackData => ({
            resumeId,
            name: techStackData.name,
            bulletPoints: techStackData.bulletPoints,
          }));
          
          // BATCH INSERT: Save all tech stacks
          await storage.createTechStacksBatch(techStacksBatchData);
          
          // Generate point groups using automatic distribution
          const pointGroups = generatePointGroupsAuto(techStacksData);
          
          // Prepare batch data for point groups
          const pointGroupsBatchData = pointGroups.map((group, i) => ({
            resumeId,
            name: `Group ${String.fromCharCode(65 + i)}`,
            points: group,
          }));
          
          // BATCH INSERT: Save all point groups
          await storage.createPointGroupsBatch(pointGroupsBatchData);
          
          // Update resume status
          await storage.updateResumeStatus(resumeId, "ready");
          
          return { resumeId, success: true, pointGroups: pointGroupsBatchData.length };
        } catch (error) {
          console.error(`Failed to process resume ${resumeId}:`, error);
          return { resumeId, success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });
      
      const results = await Promise.all(processingPromises);
      const totalTime = Date.now() - startTime;
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      console.log(`🚀 BULK PROCESSING completed: ${successCount} successful, ${failureCount} failed in ${totalTime}ms`);
      
      // Save bulk processing history
      const bulkHistory = {
        userId,
        resumeIds,
        input,
        results,
        processingTime: totalTime,
        timestamp: new Date()
      };
      
      res.json({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results,
        processingTime: totalTime,
        bulkHistory
      });
      
    } catch (error) {
      console.error("💥 Bulk processing failed:", error);
      res.status(500).json({ message: "Bulk processing failed" });
    }
  });

  // ULTRA-FAST Tech stack processing with batch operations (Individual Resume)
  app.post('/api/resumes/:id/process-tech-stack', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const startTime = Date.now();
      
      console.log(`⚡ ULTRA-FAST tech stack processing started for resume: ${id}`);
      
      const resume = await storage.getResumeById(id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      // FIXED: Use consistent user ID checking
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { input } = techStackInputSchema.parse(req.body);

      // Parse tech stack input with optimized algorithm
      const parseStartTime = Date.now();
      const techStacksData = parseTechStackInputOptimized(input);
      const parseTime = Date.now() - parseStartTime;
      console.log(`⚡ Parsing completed in ${parseTime}ms`);
      
      // ULTRA-FAST: Clear existing data first
      const dbStartTime = Date.now();
      await Promise.all([
        storage.deleteTechStacksByResumeId(id),
        storage.deletePointGroupsByResumeId(id)
      ]);
      
      // Prepare batch data for tech stacks
      const techStacksBatchData = techStacksData.map(techStackData => ({
        resumeId: id,
        name: techStackData.name,
        bulletPoints: techStackData.bulletPoints,
      }));
      
      // BATCH INSERT: Save all tech stacks in one operation
      const savedTechStacks = await storage.createTechStacksBatch(techStacksBatchData);
      console.log(`⚡ Saved ${savedTechStacks.length} tech stacks in batch`);
      
      // Generate point groups using automatic distribution
      const pointGroups = generatePointGroupsAuto(techStacksData);
      
      // Prepare batch data for point groups
      const pointGroupsBatchData = pointGroups.map((group, i) => ({
        resumeId: id,
        name: `Group ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
        points: group,
      }));
      
      // BATCH INSERT: Save all point groups in one operation
      await storage.createPointGroupsBatch(pointGroupsBatchData);
      console.log(`⚡ Saved ${pointGroupsBatchData.length} point groups in batch`);
      
      const dbTime = Date.now() - dbStartTime;
      console.log(`⚡ Database operations completed in ${dbTime}ms`);
      
      // Get the saved groups for response (cached from transaction)
      const savedGroups = await storage.getPointGroupsByResumeId(id);
      
      // Calculate average group size for response
      const avgGroupSize = savedGroups.length > 0 
        ? Math.round(savedGroups.reduce((sum, group) => sum + (group.points as Point[]).length, 0) / savedGroups.length)
        : 0;
      
      // Save processing history and update status in parallel
      const processingTime = Date.now() - startTime;
      await Promise.all([
        storage.createProcessingHistory({
          resumeId: id,
          input,
          output: savedGroups,
          settings: { autoDistribution: true, avgGroupSize },
          processingTime,
        }),
        storage.updateResumeStatus(id, "ready")
      ]);

      const totalTime = Date.now() - startTime;
      console.log(`🚀 ULTRA-FAST tech stack processing completed in ${totalTime}ms`);
      
      // Invalidate cache for this user
      (storage as any).invalidateUserCache?.(userId);

      res.json({
        groups: savedGroups,
        processingTime: totalTime,
        totalPoints: techStacksData.reduce((sum, ts) => sum + ts.bulletPoints.length, 0),
        avgGroupSize,
        distribution: 'auto',
        performance: {
          parseTime,
          dbTime,
          totalTime
        }
      });
    } catch (error) {
      console.error("💥 Tech stack processing failed:", error);
      res.status(500).json({ message: "Failed to process tech stack" });
    }
  });

  // Point groups routes
  app.get('/api/resumes/:id/point-groups', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const resume = await storage.getResumeById(id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume (FIXED: Use consistent user ID)
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const pointGroups = await storage.getPointGroupsByResumeId(id);
      res.json(pointGroups);
    } catch (error) {
      console.error("Error fetching point groups:", error);
      res.status(500).json({ message: "Failed to fetch point groups" });
    }
  });

  // Tech stacks routes
  app.get('/api/resumes/:id/tech-stacks', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const resume = await storage.getResumeById(id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume (FIXED: Use consistent user ID)
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const techStacks = await storage.getTechStacksByResumeId(id);
      res.json(techStacks);
    } catch (error) {
      console.error("Error fetching tech stacks:", error);
      res.status(500).json({ message: "Failed to fetch tech stacks" });
    }
  });

  // Processing history routes
  app.get('/api/resumes/:id/processing-history', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const resume = await storage.getResumeById(id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume (FIXED: Use consistent user ID)
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const history = await storage.getProcessingHistoryByResumeId(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching processing history:", error);
      res.status(500).json({ message: "Failed to fetch processing history" });
    }
  });

  // DOCX Export route - Generate real DOCX from HTML content
  app.post('/api/resumes/:id/export-docx', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content, options = {} } = req.body;
      
      const resume = await storage.getResumeById(id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Use provided content or resume's customized content
      const htmlContent = content || resume.customizedContent || '';
      
      if (!htmlContent) {
        return res.status(400).json({ message: "No content to export" });
      }
      
      // Generate DOCX
      const docxBuffer = await DocxProcessor.generateDocx(htmlContent, {
        title: resume.fileName.replace('.docx', ''),
        author: 'Resume Customizer Pro User',
        ...options
      });
      
      // Set proper headers for DOCX download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${resume.fileName}"`);
      res.setHeader('Content-Length', docxBuffer.length.toString());
      
      // Send the DOCX file
      res.end(docxBuffer);
      
      console.log(`📤 DOCX exported successfully: ${resume.fileName}`);
      
    } catch (error) {
      console.error("💥 DOCX export failed:", error);
      res.status(500).json({ 
        message: "Failed to export DOCX",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // BULK EXPORT: Export multiple resumes as ZIP
  app.post('/api/resumes/bulk/export', isAuthenticated, async (req: any, res) => {
    try {
      const { resumeIds, format = 'docx' } = req.body;
      const userId = req.user.id;
      
      if (!Array.isArray(resumeIds) || resumeIds.length === 0) {
        return res.status(400).json({ message: "Resume IDs array is required" });
      }
      
      console.log(`📦 BULK EXPORT: ${resumeIds.length} resumes as ${format}`);
      
      // Verify user owns all resumes and get their data
      const resumeData = await Promise.all(
        resumeIds.map(async (id: string) => {
          const resume = await storage.getResumeById(id);
          if (!resume || resume.userId !== userId) {
            throw new Error(`Access denied to resume ${id}`);
          }
          return resume;
        })
      );
      
      if (resumeIds.length === 1) {
        // Single resume - direct download
        const resume = resumeData[0];
        const content = resume.customizedContent || resume.originalContent || '';
        
        if (!content) {
          return res.status(400).json({ message: "No content to export" });
        }
        
        const docxBuffer = await DocxProcessor.generateDocx(content, {
          title: resume.fileName.replace('.docx', ''),
          author: 'Resume Customizer Pro User'
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${resume.fileName}"`);
        res.end(docxBuffer);
      } else {
        // Multiple resumes - ZIP archive
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        // Add each resume to ZIP
        await Promise.all(resumeData.map(async (resume) => {
          const content = resume.customizedContent || resume.originalContent || '';
          if (content) {
            const docxBuffer = await DocxProcessor.generateDocx(content, {
              title: resume.fileName.replace('.docx', ''),
              author: 'Resume Customizer Pro User'
            });
            
            zip.file(resume.fileName, docxBuffer);
          }
        }));
        
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="resumes-${new Date().toISOString().split('T')[0]}.zip"`);
        res.end(zipBuffer);
      }
      
      console.log(`📦 BULK EXPORT completed: ${resumeIds.length} resumes`);
      
    } catch (error) {
      console.error("💥 Bulk export failed:", error);
      res.status(500).json({ 
        message: "Bulk export failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // BULK SAVE: Save multiple resume contents simultaneously
  app.patch('/api/resumes/bulk/content', isAuthenticated, async (req: any, res) => {
    try {
      const { updates } = req.body; // Array of {resumeId, content}
      const userId = req.user.id;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "Updates array is required" });
      }
      
      console.log(`💾 BULK SAVE: ${updates.length} resumes`);
      
      // Verify user owns all resumes
      const resumeChecks = await Promise.all(
        updates.map(async (update: any) => {
          const resume = await storage.getResumeById(update.resumeId);
          return resume && resume.userId === userId;
        })
      );
      
      if (resumeChecks.some(check => !check)) {
        return res.status(403).json({ message: "Access denied to some resumes" });
      }
      
      // Save all contents in parallel
      const savePromises = updates.map(async (update: any) => {
        try {
          await storage.updateResumeContent(update.resumeId, update.content);
          await storage.updateResumeStatus(update.resumeId, "customized");
          return { resumeId: update.resumeId, success: true };
        } catch (error) {
          console.error(`Failed to save resume ${update.resumeId}:`, error);
          return { resumeId: update.resumeId, success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });
      
      const results = await Promise.all(savePromises);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`💾 BULK SAVE completed: ${successCount}/${updates.length} successful`);
      
      res.json({
        success: true,
        saved: successCount,
        total: updates.length,
        results
      });
      
    } catch (error) {
      console.error("💥 Bulk save failed:", error);
      res.status(500).json({ message: "Bulk save failed" });
    }
  });

  // Note: User stats route moved to avoid duplication (see line 181)

  const httpServer = createServer(app);
  return httpServer;
}

