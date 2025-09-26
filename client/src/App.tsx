import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { lazy, Suspense } from 'react';
const NotFound = lazy(() => import('@/pages/not-found'));
const Landing = lazy(() => import('@/pages/landing'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const MultiResumeEditorPage = lazy(() => import('@/pages/multi-resume-editor-page'));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Suspense
      fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}
    >
      <Switch>
        {isAuthenticated ? (
          // Authenticated routes
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/editor" component={MultiResumeEditorPage} />
          </>
        ) : (
          // Non-authenticated routes
          <>
            <Route path="/" component={Landing} />
            <Route path="/login" component={Landing} />
            <Route path="/register" component={Landing} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
