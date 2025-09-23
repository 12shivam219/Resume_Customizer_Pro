import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  LogOut,
  Trash2,
  FileText,
  Edit,
  Download,
} from "lucide-react";
import FileUpload from "@/components/file-upload";
import TechStackModal from "@/components/tech-stack-modal";
import ProcessingResultsModal from "@/components/processing-results-modal";
import type { Resume, User } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  // Support multiple concurrent Tech Stack modals and result modals per resume
  const [openTechModals, setOpenTechModals] = useState<Record<string, boolean>>({});
  const [resultsByResume, setResultsByResume] = useState<Record<string, any>>({});
  const [openResultsModals, setOpenResultsModals] = useState<Record<string, boolean>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    open: false,
    resumeId: "",
    resumeName: "",
  });

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
  const {
    data: resumes = [] as Resume[],
    isLoading: resumesLoading,
    error: resumesError,
  } = useQuery({
    queryKey: ["/api/resumes"] as const,
    queryFn: async (): Promise<Resume[]> => {
      const response = await apiRequest("GET", "/api/resumes");
      if (!response.ok) {
        throw new Error("Failed to fetch resumes");
      }
      const data = await response.json();
      return data as Resume[];
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch user stats
  const { data: stats = { totalResumes: 0, customizations: 0, downloads: 0 } } =
    useQuery<{
      totalResumes: number;
      customizations: 0;
      downloads: number;
    }>({
      queryKey: ["/api/user/stats"] as const,
      queryFn: async () => {
        const response = await apiRequest("GET", "/api/user/stats");
        if (!response.ok) {
          throw new Error("Failed to fetch user stats");
        }
        const data = await response.json();
        return data;
      },
      enabled: isAuthenticated,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });

  // ULTRA-FAST Upload with optimistic updates
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to upload resumes" }));
        throw new Error(errorData.message || "Failed to upload resumes");
      }

      return await response.json();
    },
    // OPTIMISTIC UPDATES for instant UI feedback
    onMutate: async (files: FileList) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["/api/resumes"] });
      await queryClient.cancelQueries({ queryKey: ["/api/user/stats"] });

      // Snapshot previous values
      const previousResumes = queryClient.getQueryData(["/api/resumes"]);
      const previousStats = queryClient.getQueryData(["/api/user/stats"]);

      // Create optimistic resumes with unique temporary IDs
      const timestamp = Date.now();
      const optimisticResumes = Array.from(files).map((file, index) => ({
        id: `optimistic-${timestamp}-${index}`, // Unique temp ID
        fileName: file.name,
        fileSize: file.size,
        status: "uploading", // Show uploading status initially
        uploadedAt: new Date().toISOString(),
        userId: (user as User)?.id || "",
        originalContent: null,
        customizedContent: null,
        downloads: 0,
        updatedAt: new Date().toISOString(),
        isOptimistic: true, // Flag to identify optimistic updates
        uploadProgress: 0, // Could be used for progress tracking
      }));

      queryClient.setQueryData(["/api/resumes"], (old: any) => {
        console.log('🔄 Adding optimistic resumes...', optimisticResumes.length);
        console.log('Current resumes before optimistic:', old?.length || 0);
        
        // Add optimistic resumes at the beginning (newest first)
        const updated = [
          ...optimisticResumes,
          ...(old || []),
        ];
        
        console.log('Total resumes after optimistic:', updated.length);
        return updated;
      });

      queryClient.setQueryData(["/api/user/stats"], (old: any) => ({
        ...old,
        totalResumes: (old?.totalResumes || 0) + files.length,
      }));

      return { previousResumes, previousStats };
    },
    onSuccess: async (uploadedResumes) => {
      // ROBUST OPTIMISTIC UPDATE: Properly merge new resumes with existing ones
      queryClient.setQueryData(["/api/resumes"], (old: any) => {
        console.log('🚀 Upload success - merging resumes (in-place replacement) ...');
        console.log('New uploaded resumes:', uploadedResumes.length);

        // Start from current cache (may contain optimistic placeholders and existing real resumes)
        let merged: any[] = Array.isArray(old) ? [...old] : [];

        // For each uploaded resume, replace matching optimistic placeholder by filename+size; if none, add to top
        for (const uploaded of uploadedResumes as any[]) {
          const matchIdx = merged.findIndex((r: any) => (
            r?.isOptimistic === true &&
            r?.fileName === uploaded?.fileName &&
            Number(r?.fileSize) === Number(uploaded?.fileSize)
          ));

          if (matchIdx !== -1) {
            merged.splice(matchIdx, 1, uploaded);
          } else {
            merged.unshift(uploaded);
          }
        }

        console.log('Final merged list:', merged.length, 'resumes');
        return merged;
      });

      // Background reconcile with server response to ensure nothing is dropped
      try {
        const response = await apiRequest("GET", "/api/resumes");
        if (response.ok) {
          const serverResumes = await response.json();
          queryClient.setQueryData(["/api/resumes"], (current: any) => {
            const byId = new Map<string, any>();
            (serverResumes as any[]).forEach((r) => byId.set(r.id, r));
            if (Array.isArray(current)) {
              current.forEach((r) => {
                if (!byId.has(r.id)) byId.set(r.id, r);
              });
            }
            return Array.from(byId.values());
          });
        }
      } catch (e) {
        console.warn('Background reconcile failed:', e);
      }

      // Refresh stats (non-blocking)
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      
      toast({
        title: "⚡ Lightning Fast Upload!",
        description: `${uploadedResumes.length} resume(s) uploaded successfully!`,
      });
    },
    onError: (error, variables, context) => {
      console.log('❌ Upload failed, rolling back optimistic updates...');
      
      // Rollback optimistic update on error - restore previous state
      if (context?.previousResumes) {
        console.log('Rolling back resumes to previous state');
        queryClient.setQueryData(["/api/resumes"], context.previousResumes);
      }
      if (context?.previousStats) {
        console.log('Rolling back stats to previous state');
        queryClient.setQueryData(["/api/user/stats"], context.previousStats);
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
        title: "Upload Failed",
        description: error.message || "Failed to upload resume",
        variant: "destructive",
      });
    },
  });

  // ULTRA-FAST Delete with optimistic updates
  const deleteMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      await apiRequest("DELETE", `/api/resumes/${resumeId}`);
    },
    // INSTANT UI feedback
    onMutate: async (resumeId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/resumes"] });
      await queryClient.cancelQueries({ queryKey: ["/api/user/stats"] });

      const previousResumes = queryClient.getQueryData(["/api/resumes"]);
      const previousStats = queryClient.getQueryData(["/api/user/stats"]);

      // Optimistically remove from UI
      queryClient.setQueryData(["/api/resumes"], (old: any) =>
        old?.filter((r: any) => r.id !== resumeId) || []
      );

      queryClient.setQueryData(["/api/user/stats"], (old: any) => ({
        ...old,
        totalResumes: Math.max(0, (old?.totalResumes || 1) - 1),
      }));

      return { previousResumes, previousStats };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      toast({
        title: "🗡️ Lightning Delete!",
        description: "Resume deleted instantly!",
      });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousResumes) {
        queryClient.setQueryData(["/api/resumes"], context.previousResumes);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(["/api/user/stats"], context.previousStats);
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
      case "uploading":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFileIcon = (fileName: string) => {
    return "text-blue-600";
  };

  const handleTechStackProcess = (resumeId: string) => {
    setOpenTechModals((prev) => ({ ...prev, [resumeId]: true }));
  };

  const handleTechStackSuccess = (resumeId: string, data: any) => {
    // Close the tech modal for this resume and open the results modal, storing the data
    setOpenTechModals((prev) => ({ ...prev, [resumeId]: false }));
    setResultsByResume((prev) => ({ ...prev, [resumeId]: data }));
    setOpenResultsModals((prev) => ({ ...prev, [resumeId]: true }));
    queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
  };

  const handleOpenEditor = (resumeId: string) => {
    window.location.href = `/editor/${resumeId}`;
  };

  const handleDeleteConfirmation = (resumeId: string, resumeName: string) => {
    setDeleteConfirmation({ open: true, resumeId, resumeName });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmation.resumeId) {
      deleteMutation.mutate(deleteConfirmation.resumeId);
      setDeleteConfirmation({ open: false, resumeId: "", resumeName: "" });
    }
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
              <h1 className="text-xl font-semibold text-foreground">
                ResumeCustomizer Pro
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-notifications"
              >
                <Bell size={18} />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-foreground">
                    {(user as User)?.firstName?.[0] ||
                      (user as User)?.email?.[0] ||
                      "U"}
                  </span>
                </div>
                <span
                  className="text-sm font-medium text-foreground hidden sm:inline-block"
                  data-testid="text-username"
                >
                  {(user as User)?.firstName || (user as User)?.email || "User"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/auth/logout", {
                        method: "POST",
                        credentials: "include",
                      });
                      if (response.ok) {
                        window.location.href = "/";
                      } else {
                        throw new Error("Logout failed");
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to logout. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                  data-testid="button-logout"
                  className="hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                >
                  <LogOut size={16} className="mr-1.5" />
                  <span className="hidden sm:inline-block">Logout</span>
                  <span className="sm:hidden">Log Out</span>
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
          <p className="text-muted-foreground">
            Upload and customize your resumes with AI-powered precision.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Resumes</p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-total-resumes"
                  >
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
                  <p className="text-sm text-muted-foreground">
                    Customizations
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-customizations"
                  >
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
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-downloads"
                  >
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
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Upload New Resume
            </h3>
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
              <h3 className="text-lg font-semibold text-foreground">
                Your Resumes
              </h3>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <i className="fas fa-th-large"></i>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-primary/10 text-primary"
                >
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
                <p className="text-sm text-muted-foreground">
                  Upload your first DOCX resume to get started
                </p>
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
                        <FileText
                          className={getFileIcon(resume.fileName)}
                          size={20}
                        />
                      </div>
                      <div>
                        <h4
                          className="font-medium text-foreground"
                          data-testid={`text-filename-${index}`}
                        >
                          {resume.fileName}
                        </h4>
                        <p
                          className="text-sm text-muted-foreground"
                          data-testid={`text-upload-info-${index}`}
                        >
                          Uploaded{" "}
                          {resume.uploadedAt
                            ? new Date(resume.uploadedAt).toLocaleDateString()
                            : "Unknown"}{" "}
                          • {(resume.fileSize / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        className={`${(resume as any).isOptimistic ? 'bg-purple-100 text-purple-800' : getStatusColor(resume.status)} transition-all duration-200`}
                        data-testid={`badge-status-${index}`}
                      >
                        {(resume as any).isOptimistic ? (
                          <>
                            <div className="animate-pulse inline-block w-2 h-2 bg-current rounded-full mr-1" />
                            Uploading
                          </>
                        ) : resume.status === "ready" ? (
                          "Ready"
                        ) : resume.status === "customized" ? (
                          "Customized"
                        ) : resume.status === "processing" ? (
                          <>
                            <div className="animate-spin inline-block w-3 h-3 border border-current border-r-transparent rounded-full mr-1" />
                            Processing
                          </>
                        ) : (
                          "Uploaded"
                        )}
                      </Badge>

                      {resume.status === "uploaded" ||
                      resume.status === "ready" ? (
                        <Button
                          onClick={() => handleTechStackProcess(resume.id)}
                          disabled={(resume as any).isOptimistic || uploadMutation.isPending}
                          data-testid={`button-configure-${index}`}
                          className="transition-all duration-200"
                        >
                          {(resume as any).isOptimistic ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-r-transparent mr-2" />
                              Uploading...
                            </>
                          ) : (
                            "Configure Tech Stack"
                          )}
                        </Button>
                      ) : resume.status === "customized" ? (
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenEditor(resume.id)}
                          data-testid={`button-edit-${index}`}
                          className="transition-all duration-200"
                        >
                          Edit Resume
                        </Button>
                      ) : resume.status === "processing" ? (
                        <Button
                          disabled
                          data-testid={`button-processing-${index}`}
                          className="transition-all duration-200"
                        >
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-r-transparent mr-2" />
                          Processing...
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteConfirmation(resume.id, resume.fileName)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${index}`}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Multi-instance Tech Stack Modals */}
      {Object.entries(openTechModals)
        .filter(([, isOpen]) => isOpen)
        .map(([resumeId]) => (
          <TechStackModal
            key={`tech-${resumeId}`}
            open={true}
            resumeId={resumeId}
            onClose={() => setOpenTechModals((prev) => ({ ...prev, [resumeId]: false }))}
            onSuccess={(data) => handleTechStackSuccess(resumeId, data)}
          />
        ))}

      {/* Multi-instance Processing Results Modals */}
      {Object.entries(openResultsModals)
        .filter(([, isOpen]) => isOpen)
        .map(([resumeId]) => (
          <ProcessingResultsModal
            key={`results-${resumeId}`}
            open={true}
            resumeId={resumeId}
            data={resultsByResume[resumeId]}
            onClose={() => setOpenResultsModals((prev) => ({ ...prev, [resumeId]: false }))}
            onProceedToEditor={() => {
              setOpenResultsModals((prev) => ({ ...prev, [resumeId]: false }));
              handleOpenEditor(resumeId);
            }}
          />
        ))}

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmation.open} 
        onOpenChange={(open) => 
          !open && setDeleteConfirmation({ open: false, resumeId: "", resumeName: "" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resume</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmation.resumeName}"? 
              This action cannot be undone and will permanently remove the resume 
              along with all its customizations and processing history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmation({ open: false, resumeId: "", resumeName: "" })}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
