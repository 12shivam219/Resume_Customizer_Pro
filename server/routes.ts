import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertResumeSchema, insertTechStackSchema, insertPointGroupSchema, insertProcessingHistorySchema, type Point } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

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

// Validation schemas
const techStackInputSchema = z.object({
  input: z.string().min(1, "Tech stack input is required"),
  pointsPerGroup: z.number().min(3).max(10).default(6),
  distributionStrategy: z.enum(["even", "priority", "random"]).default("even"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Resume routes
  app.get('/api/resumes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const resumes = await storage.getResumesByUserId(userId);
      res.json(resumes);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  app.get('/api/resumes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const resume = await storage.getResumeById(id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if user owns this resume
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedResumes = [];

      for (const file of files) {
        // For now, store the buffer as base64 string
        // In production, you might want to use proper DOCX parsing
        const originalContent = file.buffer.toString('base64');
        
        const resumeData = insertResumeSchema.parse({
          userId,
          fileName: file.originalname,
          originalContent,
          fileSize: file.size,
          status: "uploaded",
        });

        const resume = await storage.createResume(resumeData);
        uploadedResumes.push(resume);
      }

      res.json(uploadedResumes);
    } catch (error) {
      console.error("Error uploading resumes:", error);
      res.status(500).json({ message: "Failed to upload resumes" });
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

      // Check if user owns this resume
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteResume(id);
      res.json({ message: "Resume deleted successfully" });
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  // Tech stack processing routes
  app.post('/api/resumes/:id/process-tech-stack', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const startTime = Date.now();
      
      const resume = await storage.getResumeById(id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      // Check if user owns this resume
      const userId = req.user.claims.sub;
      if (resume.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { input, pointsPerGroup, distributionStrategy } = techStackInputSchema.parse(req.body);

      // Parse tech stack input
      const techStacksData = parseTechStackInput(input);
      
      // Clear existing tech stacks and point groups
      await storage.deleteTechStacksByResumeId(id);
      await storage.deletePointGroupsByResumeId(id);

      // Save tech stacks
      for (const techStackData of techStacksData) {
        await storage.createTechStack({
          resumeId: id,
          name: techStackData.name,
          bulletPoints: techStackData.bulletPoints,
        });
      }

      // Generate point groups
      const pointGroups = generatePointGroups(techStacksData, pointsPerGroup, distributionStrategy);
      
      // Save point groups
      const savedGroups = [];
      for (let i = 0; i < pointGroups.length; i++) {
        const group = await storage.createPointGroup({
          resumeId: id,
          name: `Group ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
          points: pointGroups[i],
        });
        savedGroups.push(group);
      }

      // Save processing history
      const processingTime = Date.now() - startTime;
      await storage.createProcessingHistory({
        resumeId: id,
        input,
        output: savedGroups,
        settings: { pointsPerGroup, distributionStrategy },
        processingTime,
      });

      // Update resume status
      await storage.updateResumeStatus(id, "ready");

      res.json({
        groups: savedGroups,
        processingTime,
        totalPoints: techStacksData.reduce((sum, ts) => sum + ts.bulletPoints.length, 0),
      });
    } catch (error) {
      console.error("Error processing tech stack:", error);
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
      
      // Check if user owns this resume
      const userId = req.user.claims.sub;
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
      
      // Check if user owns this resume
      const userId = req.user.claims.sub;
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
      
      // Check if user owns this resume
      const userId = req.user.claims.sub;
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

  // User stats route
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

// Helper functions
function parseTechStackInput(input: string): Array<{ name: string; bulletPoints: string[] }> {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const techStacks: Array<{ name: string; bulletPoints: string[] }> = [];
  
  let currentTechStack: { name: string; bulletPoints: string[] } | null = null;
  
  for (const line of lines) {
    // Check if line starts with bullet point indicators
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      if (currentTechStack) {
        currentTechStack.bulletPoints.push(line.replace(/^[•\-*]\s*/, ''));
      }
    } else {
      // This is a tech stack name
      if (currentTechStack) {
        techStacks.push(currentTechStack);
      }
      currentTechStack = {
        name: line,
        bulletPoints: [],
      };
    }
  }
  
  // Add the last tech stack
  if (currentTechStack) {
    techStacks.push(currentTechStack);
  }
  
  return techStacks;
}

function generatePointGroups(
  techStacks: Array<{ name: string; bulletPoints: string[] }>,
  pointsPerGroup: number,
  distributionStrategy: string
): Point[][] {
  // Collect all points with their tech stack names
  const allPoints: Point[] = [];
  
  for (const techStack of techStacks) {
    for (const bulletPoint of techStack.bulletPoints) {
      allPoints.push({
        techStack: techStack.name,
        text: bulletPoint,
      });
    }
  }
  
  // Shuffle points if random distribution
  if (distributionStrategy === "random") {
    for (let i = allPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPoints[i], allPoints[j]] = [allPoints[j], allPoints[i]];
    }
  }
  
  // Calculate number of groups needed
  const numGroups = Math.ceil(allPoints.length / pointsPerGroup);
  const groups: Point[][] = Array.from({ length: numGroups }, () => []);
  
  // Distribute points evenly across groups
  for (let i = 0; i < allPoints.length; i++) {
    const groupIndex = i % numGroups;
    groups[groupIndex].push(allPoints[i]);
  }
  
  return groups.filter(group => group.length > 0);
}
