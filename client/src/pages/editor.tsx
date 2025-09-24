import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, History, Share, Save, Download, GripVertical, Plus } from 'lucide-react';
import ResumeEditor from '@/components/resume-editor';
import React, { lazy, Suspense } from 'react';
const SaveOptionsModal = lazy(() => import('@/components/save-options-modal'));
const TechStackModal = lazy(() => import('@/components/tech-stack-modal'));
const ProcessingResultsModal = lazy(() => import('@/components/processing-results-modal'));
import { DraggablePoint, DroppableZone, AddItemButton } from '@/components/draggable-components';
import { useDragDrop, type DragDropItem } from '@/lib/dragDrop';
import type { Resume, PointGroup, User } from '@shared/schema';

interface EditorProps {
  resumeId: string;
}

type WorkflowStep = 'techstack' | 'results' | 'editor';

export default function Editor({ resumeId }: EditorProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [saveOptionsOpen, setSaveOptionsOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());

  // Drag and drop state
  const { state: dragState, startDrag } = useDragDrop();

  // Workflow state management
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('editor');
  const [techStackModalOpen, setTechStackModalOpen] = useState(false);
  const [processingResultsOpen, setProcessingResultsOpen] = useState(false);
  const [processingResults, setProcessingResults] = useState<any>(null);

  // Initialize workflow based on URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const workflowParam = urlParams.get('workflow');

    if (workflowParam === 'techstack') {
      setCurrentStep('techstack');
      setTechStackModalOpen(true);
    } else {
      setCurrentStep('editor');
    }
  }, []);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'You are logged out. Logging in again...',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/api/login';
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch resume data
  const { data: resume, isLoading: resumeLoading } = useQuery<Resume>({
    queryKey: ['/api/resumes', resumeId],
    enabled: isAuthenticated && !!resumeId,
  });

  // Fetch point groups
  const { data: pointGroups = [] } = useQuery<PointGroup[]>({
    queryKey: ['/api/resumes', resumeId, 'point-groups'],
    enabled: isAuthenticated && !!resumeId,
  });

  // Save content mutation
  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest('PATCH', `/api/resumes/${resumeId}/content`, { content });
    },
    onSuccess: () => {
      setLastSaved(new Date());
      toast({
        title: 'Success',
        description: 'Resume saved successfully',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save resume',
        variant: 'destructive',
      });
    },
  });

  // Auto-save functionality
  useEffect(() => {
    if (content && resume) {
      const timer = setTimeout(() => {
        saveMutation.mutate(content);
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timer);
    }
  }, [content]);

  const handleSave = () => {
    if (content) {
      saveMutation.mutate(content);
    }
  };

  const handleBackToDashboard = () => {
    window.location.href = '/';
  };

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return date.toLocaleDateString();
  };

  // Workflow handlers
  const handleTechStackSuccess = (data: any) => {
    setTechStackModalOpen(false);
    setProcessingResults(data);
    setCurrentStep('results');
    setProcessingResultsOpen(true);

    // Refresh resume data and point groups
    queryClient.invalidateQueries({ queryKey: ['/api/resumes', resumeId] });
    queryClient.invalidateQueries({ queryKey: ['/api/resumes', resumeId, 'point-groups'] });
  };

  const handleProceedToEditor = () => {
    setProcessingResultsOpen(false);
    setCurrentStep('editor');

    // Update URL to remove workflow parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('workflow');
    window.history.replaceState({}, '', url.toString());
  };

  const handleTechStackClose = () => {
    setTechStackModalOpen(false);
    // If user closes tech stack modal, redirect back to multi-editor
    window.close();
  };

  const handleResultsClose = () => {
    setProcessingResultsOpen(false);
    // If user closes results modal, go back to tech stack
    setCurrentStep('techstack');
    setTechStackModalOpen(true);
  };

  if (isLoading || resumeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Resume Not Found</h2>
          <p className="text-muted-foreground mb-4">The resume you're looking for doesn't exist.</p>
          <Button onClick={handleBackToDashboard}>
            <ArrowLeft className="mr-2" size={16} />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Editor Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                data-testid="button-back"
              >
                <ArrowLeft size={18} />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground" data-testid="text-filename">
                  {resume?.fileName || 'Resume'}
                </h1>
                <p className="text-sm text-muted-foreground" data-testid="text-last-saved">
                  Last saved {formatLastSaved(lastSaved)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" data-testid="button-history">
                <History className="mr-2" size={16} />
                History
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-share">
                <Share className="mr-2" size={16} />
                Share
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-accent hover:bg-accent/90"
                data-testid="button-save"
              >
                <Save className="mr-2" size={16} />
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Show editor content only when in editor step */}
      {currentStep === 'editor' ? (
        <div className="max-w-7xl mx-auto flex h-[calc(100vh-64px)]">
          {/* Editor Sidebar */}
          <div className="w-80 bg-card border-r border-border flex flex-col">
            {/* Point Groups Panel */}
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground mb-3">Point Groups</h3>
              <div className="space-y-2">
                {pointGroups?.map((group: PointGroup, index: number) => (
                  <div
                    key={group.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedGroupId === group.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedGroupId(group.id)}
                    data-testid={`group-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-medium text-sm ${
                          selectedGroupId === group.id ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {group.name}
                      </span>
                      <span
                        className={`text-xs ${
                          selectedGroupId === group.id ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {Array.isArray(group.points) ? group.points.length : 0} points
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Group Points */}
            <div className="flex-1 p-4 overflow-y-auto">
              {selectedGroupId && (
                <>
                  <h4 className="font-medium text-foreground mb-3">
                    {pointGroups?.find((g: PointGroup) => g.id === selectedGroupId)?.name} Points
                  </h4>
                  <DroppableZone
                    id={`group-${selectedGroupId}`}
                    accepts={['bullet-point']}
                    onDrop={(item, position) => {
                      console.log(`Reordered point in group ${selectedGroupId}:`, item, position);
                      // TODO: Implement point reordering logic
                    }}
                    className="space-y-3"
                  >
                    {(
                      pointGroups?.find((g: PointGroup) => g.id === selectedGroupId)
                        ?.points as any[]
                    )?.map((point: any, index: number) => {
                      const dragItem: DragDropItem = {
                        id: `point-${selectedGroupId}-${index}`,
                        type: 'bullet-point',
                        content: point.text,
                        metadata: {
                          groupId: selectedGroupId,
                          groupName: pointGroups?.find((g: PointGroup) => g.id === selectedGroupId)
                            ?.name,
                          index,
                          originalPoint: point,
                        },
                      };

                      return (
                        <div
                          key={index}
                          className="group relative p-3 bg-card border border-border rounded-lg transition-all hover:border-primary/30 hover:shadow-md"
                          draggable
                          onDragStart={(e) => startDrag(dragItem, e)}
                          data-testid={`point-${index}`}
                        >
                          {/* Drag Handle */}
                          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                          </div>

                          <div className="pl-6">
                            <p className="text-sm text-foreground leading-relaxed mb-2">
                              {point.text}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {
                                    pointGroups?.find((g: PointGroup) => g.id === selectedGroupId)
                                      ?.name
                                  }
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Drag to resume
                                </span>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Plus size={12} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) || []}

                    {/* Add Point Button */}
                    <AddItemButton
                      onAdd={() => {
                        // TODO: Implement add new point functionality
                        console.log('Add new point to group:', selectedGroupId);
                      }}
                      label="Add New Point"
                      className="mt-3"
                    />
                  </DroppableZone>
                </>
              )}
            </div>
          </div>

          {/* Editor Main Area */}
          <div className="flex-1 flex flex-col">
            <ResumeEditor
              resume={resume as Resume}
              pointGroups={pointGroups || []}
              content={content}
              onContentChange={setContent}
              onShowSaveOptions={() => setSaveOptionsOpen(true)}
            />
          </div>
        </div>
      ) : (
        /* Workflow in progress - show placeholder */
        <div className="max-w-7xl mx-auto flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-4">
              {currentStep === 'techstack' && 'Configure your tech stacks to get started...'}
              {currentStep === 'results' && 'Review your point groups and proceed to editor...'}
            </div>
          </div>
        </div>
      )}

      {/* Save Options Modal */}
      <Suspense fallback={<div>Loading save options...</div>}>
        <SaveOptionsModal
          open={saveOptionsOpen}
          resumeId={resumeId}
          content={content}
          onClose={() => setSaveOptionsOpen(false)}
        />
      </Suspense>

      {/* Tech Stack Configuration Modal */}
      <Suspense fallback={<div>Loading modal...</div>}>
        <TechStackModal
          open={techStackModalOpen}
          resumeId={resumeId}
          onClose={handleTechStackClose}
          onSuccess={handleTechStackSuccess}
        />
      </Suspense>

      {/* Processing Results Modal */}
      <Suspense fallback={<div>Loading results...</div>}>
        <ProcessingResultsModal
          open={processingResultsOpen}
          resumeId={resumeId}
          data={processingResults}
          onClose={handleResultsClose}
          onProceedToEditor={handleProceedToEditor}
        />
      </Suspense>
    </div>
  );
}
