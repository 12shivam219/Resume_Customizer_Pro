import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, ChevronDown, MoreVertical, FileText, Edit, Download } from "lucide-react";
import FileUpload from "@/components/file-upload";
import TechStackModal from "@/components/tech-stack-modal";
import ProcessingResultsModal from "@/components/processing-results-modal";
import type { Resume, User } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [techStackModal, setTechStackModal] = useState({ open: false, resumeId: "" });
  const [processingResults, setProcessingResults] = useState({ open: false, resumeId: "", data: null });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Fetch resumes
  const { data: resumes = [], isLoading: resumesLoading } = useQuery<Resume[]>({
    queryKey: ["/api/resumes"],
    enabled: isAuthenticated,
  });

  // Fetch user stats
  const { data: stats = { totalResumes: 0, customizations: 0, downloads: 0 } } = useQuery<{
    totalResumes: number;
    customizations: number;
    downloads: number;
  }>({
    queryKey: ["/api/user/stats"],
    enabled: isAuthenticated,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
      
      const response = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      toast({
        title: "Success",
        description: "Resume(s) uploaded successfully",
      });
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
        title: "Upload Failed",
        description: error.message || "Failed to upload resume",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      await apiRequest("DELETE", `/api/resumes/${resumeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      toast({
        title: "Success",
        description: "Resume deleted successfully",
      });
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
        title: "Delete Failed",
        description: error.message || "Failed to delete resume",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
      case "customized":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-orange-100 text-orange-800";
      case "uploaded":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFileIcon = (fileName: string) => {
    return "text-blue-600";
  };

  const handleTechStackProcess = (resumeId: string) => {
    setTechStackModal({ open: true, resumeId });
  };

  const handleTechStackSuccess = (data: any) => {
    setTechStackModal({ open: false, resumeId: "" });
    setProcessingResults({ open: true, resumeId: techStackModal.resumeId, data });
    queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
  };

  const handleOpenEditor = (resumeId: string) => {
    window.location.href = `/editor/${resumeId}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="text-primary-foreground" size={20} />
              </div>
              <h1 className="text-xl font-semibold text-foreground">ResumeCustomizer Pro</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" data-testid="button-notifications">
                <Bell size={18} />
              </Button>
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-foreground">
                    {(user as User)?.firstName?.[0] || (user as User)?.email?.[0] || "U"}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground" data-testid="text-username">
                  {(user as User)?.firstName || (user as User)?.email || "User"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = "/api/logout"}
                  data-testid="button-logout"
                >
                  <ChevronDown size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome back, {(user as User)?.firstName || "there"}!
          </h2>
          <p className="text-muted-foreground">Upload and customize your resumes with AI-powered precision.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Resumes</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-resumes">
                    {stats?.totalResumes ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="text-primary" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Customizations</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-customizations">
                    {stats?.customizations ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Edit className="text-accent" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Downloads</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-downloads">
                    {stats?.downloads ?? 0}
                  </p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Download className="text-orange-600" size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Upload Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Upload New Resume</h3>
            <FileUpload
              onUpload={(files) => uploadMutation.mutate(files)}
              isUploading={uploadMutation.isPending}
            />
          </CardContent>
        </Card>

        {/* Uploaded Resumes Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Your Resumes</h3>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <i className="fas fa-th-large"></i>
                </Button>
                <Button variant="ghost" size="sm" className="bg-primary/10 text-primary">
                  <i className="fas fa-list"></i>
                </Button>
              </div>
            </div>

            {resumesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading resumes...</p>
              </div>
            ) : resumes?.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No resumes uploaded yet</p>
                <p className="text-sm text-muted-foreground">Upload your first DOCX resume to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {resumes?.map((resume: Resume, index: number) => (
                  <div
                    key={resume.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                    data-testid={`card-resume-${index}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className={getFileIcon(resume.fileName)} size={20} />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground" data-testid={`text-filename-${index}`}>
                          {resume.fileName}
                        </h4>
                        <p className="text-sm text-muted-foreground" data-testid={`text-upload-info-${index}`}>
                          Uploaded {resume.uploadedAt ? new Date(resume.uploadedAt).toLocaleDateString() : 'Unknown'} • {(resume.fileSize / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        className={getStatusColor(resume.status)}
                        data-testid={`badge-status-${index}`}
                      >
                        {resume.status === "ready" ? "Ready" : 
                         resume.status === "customized" ? "Customized" :
                         resume.status === "processing" ? "Processing" : "Uploaded"}
                      </Badge>
                      
                      {(resume.status === "uploaded" || resume.status === "ready") ? (
                        <Button
                          onClick={() => handleTechStackProcess(resume.id)}
                          disabled={false}
                          data-testid={`button-configure-${index}`}
                        >
                          {"Configure Tech Stack"}
                        </Button>
                      ) : resume.status === "customized" ? (
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenEditor(resume.id)}
                          data-testid={`button-edit-${index}`}
                        >
                          Edit Resume
                        </Button>
                      ) : null}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(resume.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-menu-${index}`}
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <TechStackModal
        open={techStackModal.open}
        resumeId={techStackModal.resumeId}
        onClose={() => setTechStackModal({ open: false, resumeId: "" })}
        onSuccess={handleTechStackSuccess}
      />

      <ProcessingResultsModal
        open={processingResults.open}
        resumeId={processingResults.resumeId}
        data={processingResults.data}
        onClose={() => setProcessingResults({ open: false, resumeId: "", data: null })}
        onProceedToEditor={() => {
          setProcessingResults({ open: false, resumeId: "", data: null });
          handleOpenEditor(processingResults.resumeId);
        }}
      />
    </div>
  );
}
