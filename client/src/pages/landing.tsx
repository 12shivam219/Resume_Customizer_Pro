import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Edit,
  Download,
  Users,
  Star,
  ArrowRight,
} from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Landing() {
  const [authDialog, setAuthDialog] = useState<"login" | "register" | null>(
    null
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
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

            <div className="flex gap-2">
              <Button
                onClick={() => setAuthDialog("login")}
                variant="outline"
                data-testid="button-login"
              >
                Login
              </Button>
              <Button
                onClick={() => setAuthDialog("register")}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-register"
              >
                Register
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
            Customize Your Resume with
            <span className="text-primary"> AI-Powered Precision</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your DOCX resume, organize tech skills into strategic groups,
            and create tailored versions for every job application.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90"
              onClick={() => (window.location.href = "/api/login")}
              data-testid="button-get-started"
            >
              Get Started Free
              <ArrowRight className="ml-2" size={20} />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border hover:bg-secondary"
              data-testid="button-learn-more"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Everything You Need to Stand Out
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="text-primary" size={24} />
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-2">
                  DOCX Upload & Editing
                </h4>
                <p className="text-muted-foreground">
                  Upload your existing resume and edit it with our powerful
                  rich-text editor. Full Microsoft Word compatibility.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Edit className="text-accent" size={24} />
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-2">
                  Smart Tech Stack Processing
                </h4>
                <p className="text-muted-foreground">
                  Organize your technical skills and bullet points into
                  strategic groups for targeted job applications.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <Download className="text-orange-600" size={24} />
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-2">
                  Export & Cloud Storage
                </h4>
                <p className="text-muted-foreground">
                  Download as DOCX/PDF or save directly to Google Drive. Access
                  your resumes anywhere.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            How It Works
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">
                  1
                </span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Upload Resume
              </h4>
              <p className="text-muted-foreground">
                Upload your DOCX resume files
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">
                  2
                </span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Add Tech Stacks
              </h4>
              <p className="text-muted-foreground">
                Input your technical skills and bullet points
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">
                  3
                </span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Generate Groups
              </h4>
              <p className="text-muted-foreground">
                AI organizes points into strategic groups
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">
                  4
                </span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Customize & Export
              </h4>
              <p className="text-muted-foreground">
                Edit and download your tailored resume
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to Create Your Perfect Resume?
          </h3>
          <p className="text-xl text-primary-foreground/80 mb-8">
            Join thousands of professionals who've landed their dream jobs with
            our platform.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => (window.location.href = "/api/login")}
            className="bg-white text-primary hover:bg-white/90"
            data-testid="button-start-now"
          >
            Start Customizing Now
            <ArrowRight className="ml-2" size={20} />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="text-primary-foreground" size={16} />
            </div>
            <span className="text-lg font-semibold text-foreground">
              ResumeCustomizer Pro
            </span>
          </div>
          <p className="text-muted-foreground">
            © 2024 ResumeCustomizer Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
