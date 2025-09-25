import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Grid, Layers, Settings, ArrowLeft, FileText, CheckCircle, Users, ArrowRight } from 'lucide-react';
import MultiResumeManager from '@/components/multi-resume-manager';
import SideBySideEditor from '@/components/side-by-side-editor';
import { useBulkExport, ExportProgressDialog } from '@/hooks/useBulkExport';
import { toast } from 'sonner';
import type { Resume } from '@shared/schema';

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
type SideBySideStep = 'select-resumes' | 'configure-tech-stack' | 'editor';

export default function MultiResumeEditorPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [openResumes, setOpenResumes] = useState<{ [key: string]: OpenResume }>({});
  const [editorMode, setEditorMode] = useState<EditorMode>('tabs');
  const [sideBySideStep, setSideBySideStep] = useState<SideBySideStep>('select-resumes');
  const [selectedResumeIds, setSelectedResumeIds] = useState<Set<string>>(new Set());
  const [techStackInput, setTechStackInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { isExporting, exportProgress, exportResumes, cancelExport } = useBulkExport();

  // Load user's resumes
  useEffect(() => {
    const initializeData = async () => {
      await loadResumes();
      setIsLoading(false);
    };

    initializeData();
  }, []);

  // Handle resume updates
  const handleResumeUpdate = async (resumeId: string) => {
    try {
      const response = await fetch(`/api/resumes/${resumeId}`);
      if (response.ok) {
        const updatedResume = await response.json();
        setResumes((prev) => prev.map((r) => (r.id === resumeId ? updatedResume : r)));

        // Update open resume if it exists
        if (openResumes[resumeId]) {
          setOpenResumes((prev) => ({
            ...prev,
            [resumeId]: {
              ...prev[resumeId],
              resume: updatedResume,
              hasChanges: false,
              lastSaved: new Date(),
            },
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
    setOpenResumes((prev) => ({
      ...prev,
      [resumeId]: {
        ...prev[resumeId],
        content,
        hasChanges: true,
      },
    }));
  };

  // Handle saving individual resume in side-by-side mode
  const handleSaveResume = async (resumeId: string) => {
    const openResume = openResumes[resumeId];
    if (!openResume) return;

    try {
      const response = await fetch(`/api/resumes/${resumeId}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: openResume.content }),
      });

      if (!response.ok) throw new Error('Failed to save resume');

      setOpenResumes((prev) => ({
        ...prev,
        [resumeId]: {
          ...prev[resumeId],
          hasChanges: false,
          lastSaved: new Date(),
        },
      }));

      toast.success(`Saved ${openResume.resume.fileName}`);
      await handleResumeUpdate(resumeId);
    } catch (error) {
      console.error('Failed to save resume:', error);
      toast.error('Failed to save resume');
    }
  };

  // Handle resume selection for side-by-side mode
  const handleResumeSelection = (resumeId: string, checked: boolean) => {
    const newSelected = new Set(selectedResumeIds);
    if (checked) {
      newSelected.add(resumeId);
    } else {
      newSelected.delete(resumeId);
    }
    setSelectedResumeIds(newSelected);
  };

  // Handle select all / deselect all for side-by-side mode
  const handleSelectAll = () => {
    if (selectedResumeIds.size === resumes.length) {
      // Deselect all
      setSelectedResumeIds(new Set());
    } else {
      // Select all
      const allResumeIds = new Set(resumes.map(resume => resume.id));
      setSelectedResumeIds(allResumeIds);
    }
  };

  // Handle tech stack processing for selected resumes
  const handleTechStackProcessing = async () => {
    if (selectedResumeIds.size === 0) {
      toast.error('Please select at least one resume');
      return;
    }

    if (!techStackInput.trim()) {
      toast.error('Please enter tech stack information');
      return;
    }

    try {
      const resumeIdsArray = Array.from(selectedResumeIds);
      console.log('🚀 Starting tech stack processing for resumes:', resumeIdsArray);
      console.log('📝 Tech stack input:', techStackInput.substring(0, 100) + '...');
      
      // Process tech stack for all selected resumes
      const response = await fetch('/api/resumes/bulk/process-tech-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeIds: resumeIdsArray,
          input: techStackInput,
        }),
      });

      console.log('📡 API Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Tech stack processing result:', result);
      
      if (result.success && result.successful > 0) {
        toast.success(`Successfully processed tech stack for ${result.successful} resumes`);
        
        // Open the processed resumes
        const newOpenResumes: { [key: string]: OpenResume } = {};
        
        for (const resumeId of resumeIdsArray) {
          const resume = resumes.find(r => r.id === resumeId);
          if (resume) {
            console.log(`📄 Fetching updated data for resume: ${resume.fileName}`);
            // Fetch updated resume data with point groups
            const [resumeResponse, pointGroupsResponse] = await Promise.all([
              fetch(`/api/resumes/${resumeId}`),
              fetch(`/api/resumes/${resumeId}/point-groups`)
            ]);
            
            if (resumeResponse.ok && pointGroupsResponse.ok) {
              const resumeData = await resumeResponse.json();
              const pointGroups = await pointGroupsResponse.json();
              console.log(`📊 Point groups for ${resume.fileName}:`, pointGroups.length);
              
              newOpenResumes[resumeId] = {
                id: resumeId,
                resume: resumeData,
                content: resumeData.customizedContent || resumeData.originalContent || '',
                pointGroups: pointGroups,
                hasChanges: false,
                isProcessing: false,
                lastSaved: new Date(resumeData.updatedAt || Date.now()),
              };
            }
          }
        }
        
        console.log('🎯 Opening multi-editor with resumes:', Object.keys(newOpenResumes));
        setOpenResumes(newOpenResumes);
        setSideBySideStep('editor');
        
        // Update the resumes list
        await loadResumes();
      } else {
        throw new Error(`Processing failed: ${result.failed} resumes failed`);
      }
      
    } catch (error) {
      console.error('💥 Tech stack processing error:', error);
      toast.error(`Failed to process tech stack: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Load resumes function (extracted from useEffect)
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

    setOpenResumes((prev) => {
      const newOpenResumes = { ...prev };
      delete newOpenResumes[resumeId];
      return newOpenResumes;
    });
  };

  // Handle save all in side-by-side mode
  const handleSaveAll = async () => {
    const resumesToSave = Object.values(openResumes).filter((r) => r.hasChanges);

    if (resumesToSave.length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      await Promise.all(
        resumesToSave.map((openResume) =>
          fetch(`/api/resumes/${openResume.id}/content`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: openResume.content }),
          })
        )
      );

      setOpenResumes((prev) => {
        const updated = { ...prev };
        resumesToSave.forEach((openResume) => {
          updated[openResume.id] = {
            ...updated[openResume.id],
            hasChanges: false,
            lastSaved: new Date(),
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
      console.error('Failed to save resumes:', error);
      toast.error('Failed to save some resumes');
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

            <Badge variant="outline">{resumes.length} resumes available</Badge>

            {Object.keys(openResumes).length > 0 && (
              <Badge variant="secondary">{Object.keys(openResumes).length} open</Badge>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 border rounded-lg p-1">
              <Button
                variant={editorMode === 'tabs' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setEditorMode('tabs')}
                className="flex items-center space-x-1"
              >
                <Layers size={14} />
                <span>Tabs</span>
              </Button>
              <Button
                variant={editorMode === 'side-by-side' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  if (editorMode !== 'side-by-side') {
                    // Reset side-by-side workflow state
                    setSideBySideStep('select-resumes');
                    setSelectedResumeIds(new Set());
                    setTechStackInput('');
                    setOpenResumes({});
                  }
                  setEditorMode('side-by-side');
                }}
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
          // Side-by-side mode with multi-step workflow
          <div className="h-full">
            {sideBySideStep === 'select-resumes' && (
              <ResumeSelectionStep
                resumes={resumes}
                selectedResumeIds={selectedResumeIds}
                onResumeSelection={handleResumeSelection}
                onSelectAll={handleSelectAll}
                onNext={() => setSideBySideStep('configure-tech-stack')}
              />
            )}
            
            {sideBySideStep === 'configure-tech-stack' && (
              <TechStackConfigurationStep
                selectedResumeIds={selectedResumeIds}
                resumes={resumes}
                techStackInput={techStackInput}
                onTechStackInputChange={setTechStackInput}
                onBack={() => setSideBySideStep('select-resumes')}
                onProcess={handleTechStackProcessing}
              />
            )}
            
            {sideBySideStep === 'editor' && (
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
              <span>Ready: {resumes.filter((r) => r.status === 'ready').length}</span>
              <span>Customized: {resumes.filter((r) => r.status === 'customized').length}</span>
            </div>

            {editorMode === 'side-by-side' && (
              <div className="flex space-x-4">
                {sideBySideStep === 'select-resumes' && (
                  <span>Step 1: Resume Selection ({selectedResumeIds.size} selected)</span>
                )}
                {sideBySideStep === 'configure-tech-stack' && (
                  <span>Step 2: Tech Stack Configuration ({selectedResumeIds.size} resumes)</span>
                )}
                {sideBySideStep === 'editor' && (
                  <>
                    <span>Step 3: Multi-Editor ({Object.keys(openResumes).length} open)</span>
                    {Object.values(openResumes).some((r) => r.hasChanges) && (
                      <span className="text-orange-600 font-medium">Unsaved Changes</span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Resume Selection Step Component
interface ResumeSelectionStepProps {
  resumes: Resume[];
  selectedResumeIds: Set<string>;
  onResumeSelection: (resumeId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onNext: () => void;
}

function ResumeSelectionStep({ resumes, selectedResumeIds, onResumeSelection, onSelectAll, onNext }: ResumeSelectionStepProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <Users className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-2xl font-semibold mb-2">Select Resumes for Multi-Editor</h2>
            <p className="text-gray-600">Choose the resumes you want to edit simultaneously in side-by-side mode</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="outline">
                {selectedResumeIds.size} of {resumes.length} selected
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
              >
                {selectedResumeIds.size === resumes.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <Button 
              onClick={onNext}
              disabled={selectedResumeIds.size === 0}
              className="flex items-center space-x-2"
            >
              <span>Next: Configure Tech Stack</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map((resume) => (
              <Card 
                key={resume.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedResumeIds.has(resume.id) 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'hover:border-blue-300'
                }`}
                onClick={() => onResumeSelection(resume.id, !selectedResumeIds.has(resume.id))}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedResumeIds.has(resume.id)}
                        onCheckedChange={(checked) => onResumeSelection(resume.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <FileText className="text-blue-600" size={20} />
                    </div>
                    <Badge variant="outline">{resume.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="font-medium text-sm mb-2">{resume.fileName}</h4>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{(resume.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                    <span>{resume.updatedAt ? new Date(resume.updatedAt).toLocaleDateString() : '-'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tech Stack Configuration Step Component
interface TechStackConfigurationStepProps {
  selectedResumeIds: Set<string>;
  resumes: Resume[];
  techStackInput: string;
  onTechStackInputChange: (value: string) => void;
  onBack: () => void;
  onProcess: () => void;
}

function TechStackConfigurationStep({ 
  selectedResumeIds, 
  resumes, 
  techStackInput, 
  onTechStackInputChange, 
  onBack, 
  onProcess 
}: TechStackConfigurationStepProps) {
  const selectedResumes = resumes.filter(r => selectedResumeIds.has(r.id));
  
  const defaultTechStackInput = `React
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
• Implemented database migrations and versioning`;
  
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <Settings className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-2xl font-semibold mb-2">Configure Tech Stack</h2>
            <p className="text-gray-600">
              Add technical skills and bullet points that will be processed for all selected resumes
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">
                {selectedResumeIds.size} resumes selected
              </Badge>
              
              <div className="flex -space-x-2">
                {selectedResumes.slice(0, 3).map((resume, index) => (
                  <div
                    key={resume.id}
                    className="w-8 h-8 bg-blue-100 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-blue-600"
                    title={resume.fileName}
                  >
                    {resume.fileName.substring(0, 1).toUpperCase()}
                  </div>
                ))}
                {selectedResumes.length > 3 && (
                  <div className="w-8 h-8 bg-gray-100 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                    +{selectedResumes.length - 3}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onBack}>
                Back to Selection
              </Button>
              
              <Button 
                onClick={onProcess}
                disabled={!techStackInput.trim()}
                className="flex items-center space-x-2"
              >
                <CheckCircle size={16} />
                <span>Process & Open Editor</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Settings className="mr-2" size={18} />
                    Tech Stack Input
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="tech-input" className="text-sm font-medium mb-2 block">
                      Enter your technical skills and corresponding bullet points
                    </Label>
                    <Textarea
                      id="tech-input"
                      value={techStackInput}
                      onChange={(e) => onTechStackInputChange(e.target.value)}
                      placeholder={defaultTechStackInput}
                      className="min-h-64 font-mono text-sm"
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Format Guidelines:</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>• Enter tech stack name on its own line</p>
                      <p>• Follow with bullet points using • symbol</p>
                      <p>• Leave blank line between different tech stacks</p>
                    </div>
                  </div>
                  
                  {!techStackInput.trim() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTechStackInputChange(defaultTechStackInput)}
                      className="w-full"
                    >
                      Use Example Tech Stack
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Selected Resumes Section */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="mr-2" size={18} />
                    Selected Resumes ({selectedResumeIds.size})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedResumes.map((resume) => (
                      <div
                        key={resume.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="text-blue-600" size={16} />
                          <div>
                            <p className="font-medium text-sm">{resume.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {(resume.fileSize / 1024 / 1024).toFixed(1)} MB • {resume.status}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {resume.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <CheckCircle className="mx-auto mb-2 text-green-600" size={24} />
                    <p className="text-sm font-medium text-green-800">Ready to Process</p>
                    <p className="text-xs text-green-700 mt-1">
                      Tech stack will be processed for all {selectedResumeIds.size} resumes simultaneously
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
