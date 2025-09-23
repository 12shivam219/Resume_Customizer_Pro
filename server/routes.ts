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
  
  console.log(`⚡ Auto-distributing ${totalPoints} points into ~${numGroups} groups of ~${adjustedGroupSize} points each`);
  
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
  
  console.log(`⚡ Generated ${validGroups.length} balanced groups`);
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
      const { email, password } = req.body;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser(email, hashedPassword);
      
      req.logIn(user, (err) => {
        if (err) throw err;
        res.json(user);
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Failed to register user' });
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
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      const resume = await storage.getResumeById(id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      // Check if user owns this resume (FIXED: Use consistent user ID)
      const userId = req.user.id;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateResumeContent(id, content);
      await storage.updateResumeStatus(id, "customized");
      
      res.json({ message: "Resume content updated successfully" });
    } catch (error) {
      console.error("Error updating resume content:", error);
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

  // ULTRA-FAST Tech stack processing with batch operations
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

  // User stats route
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const resumes = await storage.getResumesByUserId(userId);
      
      const stats = {
        totalResumes: resumes.length,
        customizations: resumes.filter(r => r.status === 'customized').length,
        downloads: 0, // This would need to be tracked separately
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

