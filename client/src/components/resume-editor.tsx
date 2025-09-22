import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Undo,
  Redo,
  Download
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Resume, PointGroup } from "@shared/schema";

interface ResumeEditorProps {
  resume: Resume;
  pointGroups: PointGroup[];
  content: string;
  onContentChange: (content: string) => void;
  onShowSaveOptions: () => void;
}

export default function ResumeEditor({
  resume,
  pointGroups,
  content,
  onContentChange,
  onShowSaveOptions,
}: ResumeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [documentStats, setDocumentStats] = useState({
    pages: 1,
    words: 0,
    characters: 0,
  });

  // Initialize content from resume if not already set
  useEffect(() => {
    if (!content && resume.customizedContent) {
      onContentChange(resume.customizedContent);
    } else if (!content) {
      // Set default resume content
      const defaultContent = generateDefaultResumeContent();
      onContentChange(defaultContent);
    }
  }, [resume, content, onContentChange]);

  // Update document stats when content changes
  useEffect(() => {
    if (content) {
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const characterCount = content.length;
      
      setDocumentStats({
        pages: 1,
        words: wordCount,
        characters: characterCount,
      });
    }
  }, [content]);

  const generateDefaultResumeContent = () => {
    return `
<div class="bg-white p-8 min-h-[11in] max-w-4xl mx-auto">
  <!-- Resume Header -->
  <div class="text-center mb-6 border-b pb-4 border-gray-200">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">John Doe</h1>
    <p class="text-lg text-gray-600">Senior Software Engineer</p>
    <div class="mt-2 text-sm text-gray-500">
      Email: john.doe@email.com | Phone: (555) 123-4567 | LinkedIn: linkedin.com/in/johndoe
    </div>
  </div>

  <!-- Professional Summary -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Professional Summary</h2>
    <p class="text-gray-700 leading-relaxed">
      Experienced software engineer with 5+ years of expertise in full-stack development, 
      specializing in React, Python, and cloud technologies. Proven track record of delivering 
      scalable web applications and leading cross-functional teams.
    </p>
  </div>

  <!-- Technical Skills -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Technical Skills</h2>
    <ul class="space-y-2 text-gray-700">
      <li class="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 transition-colors">
        <strong class="text-blue-600 min-w-20">React:</strong>
        <span>Implemented state management with Redux for complex UIs</span>
      </li>
      <li class="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 transition-colors">
        <strong class="text-blue-600 min-w-20">Python:</strong>
        <span>Developed REST APIs using FastAPI and SQLAlchemy ORM</span>
      </li>
      <li class="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 transition-colors">
        <strong class="text-blue-600 min-w-20">PostgreSQL:</strong>
        <span>Designed normalized database schemas for scalability</span>
      </li>
    </ul>
  </div>

  <!-- Professional Experience -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Professional Experience</h2>
    
    <div class="mb-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-medium text-gray-900">Senior Software Engineer</h3>
          <p class="text-gray-600">TechCorp Inc.</p>
        </div>
        <span class="text-gray-500 text-sm">2021 - Present</span>
      </div>
      <ul class="ml-4 space-y-1 text-gray-700">
        <li class="list-disc">Led development of microservices architecture serving 1M+ daily users</li>
        <li class="list-disc">Improved application performance by 40% through code optimization</li>
        <li class="list-disc">Mentored junior developers and established coding standards</li>
      </ul>
    </div>

    <div class="mb-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-medium text-gray-900">Software Engineer</h3>
          <p class="text-gray-600">StartupXYZ</p>
        </div>
        <span class="text-gray-500 text-sm">2019 - 2021</span>
      </div>
      <ul class="ml-4 space-y-1 text-gray-700">
        <li class="list-disc">Built responsive web applications using React and Node.js</li>
        <li class="list-disc">Implemented CI/CD pipelines reducing deployment time by 60%</li>
        <li class="list-disc">Collaborated with design team to improve user experience</li>
      </ul>
    </div>
  </div>

  <!-- Education -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Education</h2>
    <div class="flex justify-between items-start">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Bachelor of Science in Computer Science</h3>
        <p class="text-gray-600">University of Technology</p>
      </div>
      <span class="text-gray-500 text-sm">2015 - 2019</span>
    </div>
  </div>
</div>
    `.trim();
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML;
      onContentChange(htmlContent);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleHeadingChange = (value: string) => {
    if (value === "paragraph") {
      execCommand("formatBlock", "div");
    } else {
      execCommand("formatBlock", value);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-secondary p-3 flex items-center space-x-2 border-b border-border">
        {/* Formatting Controls */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("bold")}
            data-testid="button-bold"
          >
            <Bold size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("italic")}
            data-testid="button-italic"
          >
            <Italic size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("underline")}
            data-testid="button-underline"
          >
            <Underline size={16} />
          </Button>
        </div>

        {/* Heading Controls */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Select onValueChange={handleHeadingChange}>
            <SelectTrigger className="w-32" data-testid="select-heading">
              <SelectValue placeholder="Normal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="div">Normal</SelectItem>
              <SelectItem value="h1">Heading 1</SelectItem>
              <SelectItem value="h2">Heading 2</SelectItem>
              <SelectItem value="h3">Heading 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List Controls */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("insertUnorderedList")}
            data-testid="button-bullet-list"
          >
            <List size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("insertOrderedList")}
            data-testid="button-ordered-list"
          >
            <ListOrdered size={16} />
          </Button>
        </div>

        {/* Alignment */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("justifyLeft")}
            data-testid="button-align-left"
          >
            <AlignLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("justifyCenter")}
            data-testid="button-align-center"
          >
            <AlignCenter size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("justifyRight")}
            data-testid="button-align-right"
          >
            <AlignRight size={16} />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("undo")}
            data-testid="button-undo"
          >
            <Undo size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand("redo")}
            data-testid="button-redo"
          >
            <Redo size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowSaveOptions}
            data-testid="button-export"
          >
            <Download className="mr-2" size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-muted/20">
          <div
            ref={editorRef}
            contentEditable
            className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8 min-h-[11in] border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ width: "8.5in" }}
            onInput={handleEditorInput}
            dangerouslySetInnerHTML={{ __html: content }}
            data-testid="editor-content"
          />
        </div>

        {/* Preview Panel */}
        <div className="w-80 bg-card border-l border-border p-4 hidden xl:block">
          <h4 className="font-medium text-foreground mb-3">Live Preview</h4>
          <div className="bg-muted/30 rounded-lg p-3 text-xs">
            <p className="text-muted-foreground mb-2">Document Stats:</p>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Pages:</span>
                <span data-testid="text-pages">{documentStats.pages}</span>
              </div>
              <div className="flex justify-between">
                <span>Words:</span>
                <span data-testid="text-words">{documentStats.words}</span>
              </div>
              <div className="flex justify-between">
                <span>Characters:</span>
                <span data-testid="text-characters">{documentStats.characters}</span>
              </div>
            </div>
          </div>

          {/* Collaboration Panel */}
          <div className="mt-6">
            <h4 className="font-medium text-foreground mb-3">Collaborators</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs text-primary-foreground">J</span>
                </div>
                <span className="text-sm text-foreground">You</span>
                <span className="text-xs text-accent">● Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
