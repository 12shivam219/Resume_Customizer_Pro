import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Grid, 
  Layers,
  Settings,
  ArrowLeft
} from "lucide-react";
import MultiResumeManager from "@/components/multi-resume-manager";
import SideBySideEditor from "@/components/side-by-side-editor";
import { useBulkExport, ExportProgressDialog } from "@/hooks/useBulkExport";
import { toast } from "sonner";
import type { Resume } from "@shared/schema";

interface OpenResume {
  id: string;
  resume: Resume;
  content: string;
  pointGroups: any[];
  hasChanges: boolean;
  isProcessing: boolean;
  lastSaved: Date | null;
}

type EditorMode = 'tabs' | 'side-by-side';

export default function MultiResumeEditorPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [openResumes, setOpenResumes] = useState<{ [key: string]: OpenResume }>({});
  const [editorMode, setEditorMode] = useState<EditorMode>('tabs');
  const [isLoading, setIsLoading] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const { 
    isExporting, 
    exportProgress, 
    exportResumes, 
    cancelExport 
  } = useBulkExport();

  // Load user's resumes
  useEffect(() => {
    const loadResumes = async () => {
      try {
        const response = await fetch('/api/resumes');
        if (response.ok) {
          const resumesData = await response.json();
          setResumes(resumesData);
        } else {
          toast.error('Failed to load resumes');
        }
      } catch (error) {
        console.error('Failed to load resumes:', error);
        toast.error('Failed to load resumes');
      } finally {
        setIsLoading(false);
      }
    };

    loadResumes();
  }, []);

  // Handle resume updates
  const handleResumeUpdate = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resumes/${resumeId}`);
      if (response.ok) {
        const updatedResume = await response.json();
        setResumes(prev => 
          prev.map(r => r.id === resumeId ? updatedResume : r)
        );
        
        // Update open resume if it exists
        if (openResumes[resumeId]) {
          setOpenResumes(prev => ({
            ...prev,
            [resumeId]: {
              ...prev[resumeId],
              resume: updatedResume,
              hasChanges: false,
              lastSaved: new Date()
            }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to update resume:', error);
    }
  };

  // Handle bulk export
  const handleBulkExport = async (resumeIds: string[]) => {
    setShowExportDialog(true);
    await exportResumes(resumeIds);
  };

  // Handle content changes in side-by-side mode
  const handleContentChange = (resumeId: string, content: string) => {
    setOpenResumes(prev => ({
      ...prev,
      [resumeId]: {
        ...prev[resumeId],
        content,
        hasChanges: true
      }
    }));
  };

  // Handle saving individual resume in side-by-side mode
  const handleSaveResume = async (resumeId: string) => {
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
      await handleResumeUpdate(resumeId);
    } catch (error) {
      console.error("Failed to save resume:", error);
      toast.error("Failed to save resume");
    }
  };

  // Handle closing resume in side-by-side mode
  const handleCloseResume = (resumeId: string) => {
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
  };

  // Handle save all in side-by-side mode
  const handleSaveAll = async () => {
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
      
      // Update all resumes
      for (const openResume of resumesToSave) {
        await handleResumeUpdate(openResume.id);
      }
    } catch (error) {
      console.error("Failed to save resumes:", error);
      toast.error("Failed to save some resumes");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading resumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </Button>
            
            <h1 className="text-xl font-semibold">Multi-Resume Editor</h1>
            
            <Badge variant="outline">
              {resumes.length} resumes available
            </Badge>
            
            {Object.keys(openResumes).length > 0 && (
              <Badge variant="secondary">
                {Object.keys(openResumes).length} open
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 border rounded-lg p-1">
              <Button
                variant={editorMode === 'tabs' ? "default" : "ghost"}
                size="sm"
                onClick={() => setEditorMode('tabs')}
                className="flex items-center space-x-1"
              >
                <Layers size={14} />
                <span>Tabs</span>
              </Button>
              <Button
                variant={editorMode === 'side-by-side' ? "default" : "ghost"}
                size="sm"
                onClick={() => setEditorMode('side-by-side')}
                className="flex items-center space-x-1"
              >
                <Grid size={14} />
                <span>Side-by-Side</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        {editorMode === 'tabs' ? (
          <MultiResumeManager
            resumes={resumes}
            onResumeUpdate={handleResumeUpdate}
            onBulkExport={handleBulkExport}
          />
        ) : (
          <SideBySideEditor
            openResumes={openResumes}
            onContentChange={handleContentChange}
            onSaveResume={handleSaveResume}
            onCloseResume={handleCloseResume}
            onSaveAll={handleSaveAll}
            onBulkExport={handleBulkExport}
          />
        )}
      </div>

      {/* Export Progress Dialog */}
      <ExportProgressDialog
        isOpen={showExportDialog && isExporting}
        progress={exportProgress}
        onClose={() => setShowExportDialog(false)}
        onCancel={cancelExport}
      />

      {/* Quick Stats Footer */}
      {resumes.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex space-x-6">
              <span>Total Resumes: {resumes.length}</span>
              <span>Ready: {resumes.filter(r => r.status === 'ready').length}</span>
              <span>Customized: {resumes.filter(r => r.status === 'customized').length}</span>
            </div>
            
            {editorMode === 'side-by-side' && Object.keys(openResumes).length > 0 && (
              <div className="flex space-x-4">
                <span>Open: {Object.keys(openResumes).length}</span>
                {Object.values(openResumes).some(r => r.hasChanges) && (
                  <span className="text-orange-600 font-medium">
                    Unsaved Changes
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}