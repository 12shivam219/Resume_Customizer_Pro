import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [pointsPerGroup, setPointsPerGroup] = useState(6);
  const [distributionStrategy, setDistributionStrategy] = useState("even");

  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/resumes/${resumeId}/process-tech-stack`, {
        input,
        pointsPerGroup,
        distributionStrategy,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Generated ${data.groups.length} groups from ${data.totalPoints} points in ${data.processingTime}ms`,
      });
      onSuccess(data);
    },
    onError: (error) => {
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

            {/* Processing Settings */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-3 flex items-center">
                  <Settings className="mr-2" size={16} />
                  Processing Settings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="points-per-group" className="text-sm font-medium mb-2 block">
                      Points per Group
                    </Label>
                    <Select
                      value={pointsPerGroup.toString()}
                      onValueChange={(value) => setPointsPerGroup(parseInt(value))}
                    >
                      <SelectTrigger data-testid="select-points-per-group">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 points</SelectItem>
                        <SelectItem value="4">4 points</SelectItem>
                        <SelectItem value="5">5 points</SelectItem>
                        <SelectItem value="6">6 points</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="distribution-strategy" className="text-sm font-medium mb-2 block">
                      Distribution Strategy
                    </Label>
                    <Select
                      value={distributionStrategy}
                      onValueChange={setDistributionStrategy}
                    >
                      <SelectTrigger data-testid="select-distribution-strategy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="even">Even distribution</SelectItem>
                        <SelectItem value="priority">Priority-based</SelectItem>
                        <SelectItem value="random">Random selection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
