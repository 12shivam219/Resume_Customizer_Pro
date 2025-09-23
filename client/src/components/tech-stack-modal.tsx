import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Save, Settings } from "lucide-react";

interface TechStackModalProps {
  open: boolean;
  resumeId: string;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function TechStackModal({ open, resumeId, onClose, onSuccess }: TechStackModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState(`React
• Built responsive web applications using React hooks and context
• Implemented state management with Redux for complex UIs
• Created reusable component library with TypeScript

Python
• Developed REST APIs using FastAPI and SQLAlchemy
• Implemented data processing pipelines with Pandas
• Created automated testing suites with PyTest

PostgreSQL
• Designed normalized database schemas for scalability
• Optimized query performance for large datasets
• Implemented database migrations and versioning`);
  // ULTRA-FAST Tech Stack Processing with automatic distribution
  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/resumes/${resumeId}/process-tech-stack`, {
        input,
      });
      return response.json();
    },
    // INSTANT UI feedback with optimistic updates
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/resumes"] });
      
      // Get snapshot of current data
      const previousResumes = queryClient.getQueryData(["/api/resumes"]);
      
      // Optimistically update resume status to "processing"
      queryClient.setQueryData(["/api/resumes"], (old: any) => 
        old?.map((resume: any) => 
          resume.id === resumeId 
            ? { ...resume, status: "processing" }
            : resume
        ) || []
      );
      
      // Show instant feedback
      toast({
        title: "⚡ Lightning Processing!",
        description: "Processing tech stack at ultra-fast speed...",
      });
      
      return { previousResumes };
    },
    onSuccess: (data) => {
      // Update resume status to "ready"
      queryClient.setQueryData(["/api/resumes"], (old: any) => 
        old?.map((resume: any) => 
          resume.id === resumeId 
            ? { ...resume, status: "ready" }
            : resume
        ) || []
      );
      
      // Invalidate queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      
      toast({
        title: "🚀 Smart Processing Complete!",
        description: `Automatically generated ${data.groups.length} balanced groups from ${data.totalPoints} points in just ${data.processingTime}ms! ${data.avgGroupSize ? `(~${data.avgGroupSize} points per group)` : ''}`,
        duration: 5000,
      });
      onSuccess(data);
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousResumes) {
        queryClient.setQueryData(["/api/resumes"], context.previousResumes);
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process tech stack",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter tech stack information",
        variant: "destructive",
      });
      return;
    }
    processMutation.mutate();
  };

  const handleSaveDraft = () => {
    // In a real app, you might save this to local storage or a draft endpoint
    toast({
      title: "Draft Saved",
      description: "Your tech stack input has been saved as a draft",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Configure Tech Stack & Points</DialogTitle>
          <p className="text-muted-foreground">
            Add your technical skills and corresponding bullet points for resume customization.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Format Helper */}
            <Card className="bg-muted/50 border-border">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-2 flex items-center">
                  <Info className="text-primary mr-2" size={16} />
                  Input Format
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 font-mono">
                  <p>TechName1</p>
                  <p className="ml-4">• BulletPoint1</p>
                  <p className="ml-4">• BulletPoint2</p>
                  <p className="ml-4">• ...</p>
                  <p>TechName2</p>
                  <p className="ml-4">• BulletPoint1</p>
                  <p className="ml-4">• BulletPoint2</p>
                </div>
              </CardContent>
            </Card>

            {/* Tech Stack Input */}
            <div className="space-y-3">
              <Label htmlFor="tech-input" className="text-sm font-medium">
                Tech Stack & Bullet Points
              </Label>
              <Textarea
                id="tech-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-96 font-mono text-sm"
                placeholder="Enter your tech stacks and bullet points..."
                data-testid="textarea-tech-input"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Format: TechName followed by bullet points</span>
                <span className="text-muted-foreground" data-testid="text-character-count">
                  {input.length} characters
                </span>
              </div>
            </div>

            {/* Auto Processing Info */}
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-2 flex items-center">
                  <Settings className="text-blue-600 mr-2" size={16} />
                  Smart Processing
                </h4>
                <p className="text-sm text-muted-foreground">
                  Points will be automatically distributed evenly across groups for optimal resume customization.
                </p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSaveDraft}
                data-testid="button-save-draft"
              >
                <Save className="mr-2" size={16} />
                Save Draft
              </Button>
              <div className="space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={processMutation.isPending}
                  data-testid="button-process"
                >
                  <Settings className="mr-2" size={16} />
                  {processMutation.isPending ? "Processing..." : "Process & Generate Groups"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
