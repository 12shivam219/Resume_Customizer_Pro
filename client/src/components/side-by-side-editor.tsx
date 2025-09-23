import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { 
  X, 
  Save, 
  Download, 
  FileText,
  Loader2,
  Grid,
  Maximize2,
  Minimize2,
  Eye,
  Copy,
  Settings
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

interface SideBySideEditorProps {
  openResumes: { [key: string]: OpenResume };
  onContentChange: (resumeId: string, content: string) => void;
  onSaveResume: (resumeId: string) => void;
  onCloseResume: (resumeId: string) => void;
  onSaveAll: () => void;
  onBulkExport: (resumeIds: string[]) => void;
}

type ViewLayout = 'single' | 'split-2' | 'split-3' | 'split-4' | 'grid';

export default function SideBySideEditor({
  openResumes,
  onContentChange,
  onSaveResume,
  onCloseResume,
  onSaveAll,
  onBulkExport
}: SideBySideEditorProps) {
  const [viewLayout, setViewLayout] = useState<ViewLayout>('split-2');
  const [fullscreenResume, setFullscreenResume] = useState<string | null>(null);
  const [syncScrolling, setSyncScrolling] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const resumeIds = Object.keys(openResumes);
  const resumeCount = resumeIds.length;
  const hasUnsavedChanges = Object.values(openResumes).some(r => r.hasChanges);

  // Auto-adjust layout based on number of open resumes
  const getOptimalLayout = useCallback((count: number): ViewLayout => {
    if (count <= 1) return 'single';
    if (count === 2) return 'split-2';
    if (count === 3) return 'split-3';
    return 'grid';
  }, []);

  // Copy content from one resume to another
  const copyContent = useCallback((fromResumeId: string, toResumeId: string) => {
    const sourceResume = openResumes[fromResumeId];
    if (sourceResume) {
      onContentChange(toResumeId, sourceResume.content);
      toast.success(`Copied content from ${sourceResume.resume.fileName}`);
    }
  }, [openResumes, onContentChange]);

  // Render single resume editor
  const renderResumeEditor = (resumeId: string, isFullscreen = false) => {
    const openResume = openResumes[resumeId];
    if (!openResume) return null;

    return (
      <div className={`relative h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
        {/* Resume Header */}
        <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-600" size={18} />
            <div>
              <h3 className="font-medium text-sm">{openResume.resume.fileName}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {openResume.resume.status}
                </Badge>
                {openResume.hasChanges && (
                  <Badge variant="destructive" className="text-xs">
                    Unsaved
                  </Badge>
                )}
                {openResume.isProcessing && (
                  <Badge variant="secondary" className="text-xs">
                    <Loader2 size={10} className="animate-spin mr-1" />
                    Processing
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* Copy dropdown */}
            {resumeCount > 1 && (
              <div className="relative group">
                <Button variant="ghost" size="sm" title="Copy to...">
                  <Copy size={14} />
                </Button>
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <div className="text-xs text-gray-500 mb-2">Copy content to:</div>
                  {resumeIds
                    .filter(id => id !== resumeId)
                    .map(targetId => (
                      <Button
                        key={targetId}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => copyContent(resumeId, targetId)}
                      >
                        {openResumes[targetId].resume.fileName}
                      </Button>
                    ))}
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullscreenResume(isFullscreen ? null : resumeId)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSaveResume(resumeId)}
              disabled={!openResume.hasChanges}
              title="Save"
            >
              <Save size={14} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBulkExport([resumeId])}
              title="Export"
            >
              <Download size={14} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCloseResume(resumeId)}
              title="Close"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Resume Editor */}
        <div className="h-full">
          <AdvancedResumeEditor
            resume={openResume.resume}
            pointGroups={openResume.pointGroups}
            content={openResume.content}
            onContentChange={(content) => onContentChange(resumeId, content)}
            onSave={() => onSaveResume(resumeId)}
            onShowSaveOptions={() => onBulkExport([resumeId])}
          />
        </div>
      </div>
    );
  };

  // Render layout controls
  const renderLayoutControls = () => (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1 border rounded-lg p-1">
        {[
          { layout: 'single', icon: '1', title: 'Single' },
          { layout: 'split-2', icon: '2', title: 'Split (2)' },
          { layout: 'split-3', icon: '3', title: 'Split (3)' },
          { layout: 'grid', icon: '⊞', title: 'Grid' }
        ].map(({ layout, icon, title }) => (
          <Button
            key={layout}
            variant={viewLayout === layout ? "default" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => setViewLayout(layout as ViewLayout)}
            title={title}
            disabled={layout === 'split-3' && resumeCount < 3}
          >
            {icon}
          </Button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewLayout(getOptimalLayout(resumeCount))}
        title="Auto layout"
      >
        <Grid size={14} />
      </Button>
    </div>
  );

  if (resumeCount === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No resumes open</h3>
          <p>Select resumes to start editing simultaneously</p>
        </div>
      </div>
    );
  }

  // Fullscreen mode
  if (fullscreenResume && openResumes[fullscreenResume]) {
    return renderResumeEditor(fullscreenResume, true);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Controls */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">Multi-Resume Editor</h2>
            <Badge variant="outline">
              {resumeCount} open
            </Badge>
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="animate-pulse">
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {renderLayoutControls()}
            
            <div className="flex items-center space-x-2 border-l pl-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSyncScrolling(!syncScrolling)}
                title="Sync scrolling"
              >
                <Eye size={14} className={syncScrolling ? 'text-blue-600' : ''} />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompareMode(!compareMode)}
                title="Compare mode"
              >
                <Settings size={14} className={compareMode ? 'text-blue-600' : ''} />
              </Button>
            </div>

            <div className="flex items-center space-x-2 border-l pl-3">
              <Button onClick={onSaveAll} disabled={!hasUnsavedChanges}>
                <Save size={16} className="mr-2" />
                Save All
              </Button>
              
              <Button
                variant="outline"
                onClick={() => onBulkExport(resumeIds)}
              >
                <Download size={16} className="mr-2" />
                Export All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Layout */}
      <div className="flex-1 overflow-hidden">
        {viewLayout === 'single' && (
          <div className="h-full">
            {renderResumeEditor(resumeIds[0])}
          </div>
        )}

        {viewLayout === 'split-2' && resumeCount >= 2 && (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50}>
              {renderResumeEditor(resumeIds[0])}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>
              {renderResumeEditor(resumeIds[1])}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {viewLayout === 'split-3' && resumeCount >= 3 && (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={33}>
              {renderResumeEditor(resumeIds[0])}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={33}>
              {renderResumeEditor(resumeIds[1])}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={34}>
              {renderResumeEditor(resumeIds[2])}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {viewLayout === 'grid' && (
          <div className="h-full p-4 overflow-auto">
            <div className={`grid gap-4 h-full ${
              resumeCount === 2 ? 'grid-cols-2' :
              resumeCount === 3 ? 'grid-cols-2 grid-rows-2' :
              'grid-cols-2 grid-rows-2'
            }`}>
              {resumeIds.map(resumeId => (
                <Card key={resumeId} className="overflow-hidden">
                  <div className="h-full">
                    {renderResumeEditor(resumeId)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Handle cases with fewer resumes than layout requires */}
        {(viewLayout === 'split-2' && resumeCount === 1) && (
          <div className="h-full">
            {renderResumeEditor(resumeIds[0])}
          </div>
        )}
      </div>
    </div>
  );
}