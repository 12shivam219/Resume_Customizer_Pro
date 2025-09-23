import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import MultiResumeEditorPage from "@/pages/multi-resume-editor-page";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading ? (
        // Loading state
        <div>Loading...</div>
      ) : isAuthenticated ? (
        // Authenticated routes
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/editor/:resumeId">
            {(params) => <Editor resumeId={params.resumeId} />}
          </Route>
          <Route path="/multi-editor" component={MultiResumeEditorPage} />
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
