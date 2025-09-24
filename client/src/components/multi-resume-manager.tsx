import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  X, 
  Plus, 
  Save, 
  Download, 
  FileText,
  Loader2,
  Copy,
  RotateCcw,
  Settings,
  Eye,
  EyeOff
} from "lucide-react";
import AdvancedResumeEditor from "./advanced-resume-editor";
import { toast } from "sonner";
import type { Resume, PointGroup } from "@shared/schema";

interface OpenResume {
  id: string;
  resume: Resume;
  content: string;
  pointGroups: PointGroup[];
  hasChanges: boolean;
  isProcessing: boolean;
  lastSaved: Date | null;
}

interface MultiResumeManagerProps {
  resumes: Resume[];
  onResumeUpdate: (resumeId: string) => void;
  onBulkExport: (resumeIds: string[]) => void;
}

export default function MultiResumeManager({ 
  resumes, 
  onResumeUpdate,
  onBulkExport 
}: MultiResumeManagerProps) {
  const [openResumes, setOpenResumes] = useState<{ [key: string]: OpenResume }>({});
  const [activeTab, setActiveTab] = useState<string>("");
  const [isCompactView, setIsCompactView] = useState(false);
  const [bulkOperationMode, setBulkOperationMode] = useState(false);
  const [selectedResumes, setSelectedResumes] = useState<Set<string>>(new Set());

  // Handle resume click - open in new tab with complete workflow
  const handleResumeClick = useCallback((resume: Resume) => {
    // Always open in new tab with complete workflow (tech stack -> results -> editor)
    window.open(`/editor/${resume.id}?workflow=techstack`, '_blank');
  }, []);


  // Load resume data when opening a tab (keeping for internal tab management)
  const openResumeTab = useCallback(async (resume: Resume) => {
    if (openResumes[resume.id]) {
      setActiveTab(resume.id);
      return;
    }

    try {
      // Load resume content and point groups
      const [resumeResponse, pointGroupsResponse] = await Promise.all([
        fetch(`/api/resumes/${resume.id}`),
        fetch(`/api/resumes/${resume.id}/point-groups`)
      ]);

      if (!resumeResponse.ok || !pointGroupsResponse.ok) {
        throw new Error("Failed to load resume data");
      }

      const resumeData = await resumeResponse.json();
      const pointGroups = await pointGroupsResponse.json();

      const newOpenResume: OpenResume = {
        id: resume.id,
        resume: resumeData,
        content: resumeData.customizedContent || resumeData.originalContent || "",
        pointGroups: pointGroups,
        hasChanges: false,
        isProcessing: false,
        lastSaved: new Date(resumeData.updatedAt)
      };

      setOpenResumes(prev => ({
        ...prev,
        [resume.id]: newOpenResume
      }));
      
      setActiveTab(resume.id);
      toast.success(`Opened ${resume.fileName}`);
    } catch (error) {
      console.error("Failed to open resume:", error);
      toast.error("Failed to open resume");
    }
  }, [openResumes]);

  // Close resume tab
  const closeResumeTab = useCallback((resumeId: string) => {
    const openResume = openResumes[resumeId];
    
    if (openResume?.hasChanges) {
      const confirm = window.confirm(
        `You have unsaved changes in ${openResume.resume.fileName}. Close anyway?`
      );
      if (!confirm) return;
    }

    setOpenResumes(prev => {
      const newOpenResumes = { ...prev };
      delete newOpenResumes[resumeId];
      return newOpenResumes;
    });

    // Switch to another tab if closing active tab
    if (activeTab === resumeId) {
      const remainingTabs = Object.keys(openResumes).filter(id => id !== resumeId);
      setActiveTab(remainingTabs.length > 0 ? remainingTabs[0] : "");
    }
  }, [openResumes, activeTab]);

  // Update resume content
  const updateResumeContent = useCallback((resumeId: string, content: string) => {
    setOpenResumes(prev => ({
      ...prev,
      [resumeId]: {
        ...prev[resumeId],
        content,
        hasChanges: true
      }
    }));
  }, []);

  // Save individual resume
  const saveResume = useCallback(async (resumeId: string) => {
    const openResume = openResumes[resumeId];
    if (!openResume) return;

    try {
      const response = await fetch(`/api/resumes/${resumeId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: openResume.content })
      });

      if (!response.ok) throw new Error("Failed to save resume");

      setOpenResumes(prev => ({
        ...prev,
        [resumeId]: {
          ...prev[resumeId],
          hasChanges: false,
          lastSaved: new Date()
        }
      }));

      toast.success(`Saved ${openResume.resume.fileName}`);
      onResumeUpdate(resumeId);
    } catch (error) {
      console.error("Failed to save resume:", error);
      toast.error("Failed to save resume");
    }
  }, [openResumes, onResumeUpdate]);

  // Save all open resumes
  const saveAllResumes = useCallback(async () => {
    const resumesToSave = Object.values(openResumes).filter(r => r.hasChanges);
    
    if (resumesToSave.length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      await Promise.all(
        resumesToSave.map(openResume => 
          fetch(`/api/resumes/${openResume.id}/content`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: openResume.content })
          })
        )
      );

      setOpenResumes(prev => {
        const updated = { ...prev };
        resumesToSave.forEach(openResume => {
          updated[openResume.id] = {
            ...updated[openResume.id],
            hasChanges: false,
            lastSaved: new Date()
          };
        });
        return updated;
      });

      toast.success(`Saved ${resumesToSave.length} resumes`);
      resumesToSave.forEach(r => onResumeUpdate(r.id));
    } catch (error) {
      console.error("Failed to save resumes:", error);
      toast.error("Failed to save some resumes");
    }
  }, [openResumes, onResumeUpdate]);

  // Bulk tech stack processing
  const processBulkTechStacks = useCallback(async (techStackInput: string) => {
    const selectedIds = Array.from(selectedResumes);
    if (selectedIds.length === 0) {
      toast.error("No resumes selected for bulk processing");
      return;
    }

    try {
      // Mark resumes as processing
      setOpenResumes(prev => {
        const updated = { ...prev };
        selectedIds.forEach(id => {
          if (updated[id]) {
            updated[id] = { ...updated[id], isProcessing: true };
          }
        });
        return updated;
      });

      // Process all selected resumes in parallel
      const processPromises = selectedIds.map(async (resumeId) => {
        const response = await fetch(`/api/resumes/${resumeId}/process-tech-stack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: techStackInput })
        });

        if (!response.ok) {
          throw new Error(`Failed to process ${resumeId}`);
        }

        return response.json();
      });

      await Promise.all(processPromises);

      // Update processing status
      setOpenResumes(prev => {
        const updated = { ...prev };
        selectedIds.forEach(id => {
          if (updated[id]) {
            updated[id] = { ...updated[id], isProcessing: false };
          }
        });
        return updated;
      });

      toast.success(`Processed tech stacks for ${selectedIds.length} resumes`);
    } catch (error) {
      console.error("Bulk processing failed:", error);
      toast.error("Bulk processing failed");
      
      // Reset processing status
      setOpenResumes(prev => {
        const updated = { ...prev };
        selectedIds.forEach(id => {
          if (updated[id]) {
            updated[id] = { ...updated[id], isProcessing: false };
          }
        });
        return updated;
      });
    }
  }, [selectedResumes]);

  const openResumeTabsCount = Object.keys(openResumes).length;
  const hasUnsavedChanges = Object.values(openResumes).some(r => r.hasChanges);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Action Bar */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">Resume Editor</h2>
            <Badge variant="outline">
              {openResumeTabsCount} open
            </Badge>
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="animate-pulse">
                Unsaved changes
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCompactView(!isCompactView)}
            >
              {isCompactView ? <Eye size={16} /> : <EyeOff size={16} />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkOperationMode(!bulkOperationMode)}
            >
              <Settings size={16} />
              Bulk Mode
            </Button>
            
            {openResumeTabsCount > 0 && (
              <>
                <Button onClick={saveAllResumes} disabled={!hasUnsavedChanges}>
                  <Save size={16} className="mr-2" />
                  Save All
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => onBulkExport(Object.keys(openResumes))}
                >
                  <Download size={16} className="mr-2" />
                  Export All
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Bulk Operations Panel */}
        {bulkOperationMode && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Bulk Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Select resumes for bulk processing:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(openResumes).map(openResume => (
                      <Button
                        key={openResume.id}
                        variant={selectedResumes.has(openResume.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const newSelected = new Set(selectedResumes);
                          if (newSelected.has(openResume.id)) {
                            newSelected.delete(openResume.id);
                          } else {
                            newSelected.add(openResume.id);
                          }
                          setSelectedResumes(newSelected);
                        }}
                      >
                        {openResume.resume.fileName}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={() => {
                    const input = prompt("Enter tech stack input for bulk processing:");
                    if (input) {
                      processBulkTechStacks(input);
                    }
                  }}
                  disabled={selectedResumes.size === 0}
                >
                  Process Tech Stacks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resume List - Show when no tabs open */}
      {openResumeTabsCount === 0 && (
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-medium mb-4">Select resumes to customize</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumes.map(resume => (
                <Card 
                  key={resume.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleResumeClick(resume)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <FileText className="text-blue-600" size={20} />
                      <Badge variant="outline">{resume.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h4 className="font-medium text-sm mb-2">{resume.fileName}</h4>
                    <p className="text-xs text-gray-500">
                      {(resume.fileSize / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Tab Interface */}
      {openResumeTabsCount > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="bg-white border-b">
            <TabsList className="w-full justify-start rounded-none border-none bg-transparent p-0">
              {Object.values(openResumes).map(openResume => (
                <div key={openResume.id} className="flex items-center">
                  <TabsTrigger
                    value={openResume.id}
                    className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
                  >
                    <div className="flex items-center space-x-2 max-w-40">
                      <FileText size={14} />
                      <span className="truncate text-sm">
                        {openResume.resume.fileName}
                      </span>
                      {openResume.hasChanges && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      )}
                      {openResume.isProcessing && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                    </div>
                  </TabsTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-1"
                    onClick={() => closeResumeTab(openResume.id)}
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
              
              {/* Add Resume Tab Button */}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => {
                  // Show resume picker
                  const availableResumes = resumes.filter(r => !openResumes[r.id]);
                  if (availableResumes.length > 0) {
                    // For now, open first available - could be improved with a picker
                    openResumeTab(availableResumes[0]);
                  }
                }}
              >
                <Plus size={16} />
              </Button>
            </TabsList>
          </div>

          <div className="flex-1">
            {Object.values(openResumes).map(openResume => (
              <TabsContent 
                key={openResume.id} 
                value={openResume.id}
                className="h-full m-0 p-0"
              >
                <AdvancedResumeEditor
                  resume={openResume.resume}
                  pointGroups={openResume.pointGroups}
                  content={openResume.content}
                  onContentChange={(content) => updateResumeContent(openResume.id, content)}
                  onSave={() => saveResume(openResume.id)}
                  onShowSaveOptions={() => {
                    // Individual export functionality
                    onBulkExport([openResume.id]);
                  }}
                />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}

    </div>
  );
}
