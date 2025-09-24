import { useRef, useState, DragEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, AlertCircle, CheckCircle, Info, Lightbulb } from "lucide-react";
import { useFileValidation } from "@/hooks/useValidation";
import { validateFileUpload } from "@/lib/validation";

interface FileUploadProps {
  onUpload: (files: FileList) => void;
  isUploading?: boolean;
}

export default function FileUpload({ onUpload, isUploading = false }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Create FileList from selected files for validation
  const fileList = selectedFiles.length > 0 ? (() => {
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    return dt.files;
  })() : null;
  
  // Real-time validation
  const validation = useFileValidation(fileList);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0 && validation.isValid) {
      const fileList = new DataTransfer();
      selectedFiles.forEach(file => fileList.items.add(file));
      
      // Simulate upload progress
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Let the actual upload complete the progress
          }
          return prev + 10;
        });
      }, 100);
      
      onUpload(fileList.files);
      
      // Clear after successful upload trigger
      setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 1000);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // File type analysis for better UX
  const getFileTypeColor = (file: File) => {
    if (file.type.includes('word') || file.name.endsWith('.docx')) return 'text-blue-600';
    if (file.type.includes('pdf')) return 'text-red-600';
    return 'text-gray-600';
  };
  
  const getFileTypeIcon = (file: File) => {
    return <FileText className={getFileTypeColor(file)} size={20} />;
  };
  
  return (
    <div className="space-y-4">
      {/* Validation Status */}
      {validation.hasValidated && (
        <div className="space-y-2">
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.errors.map((error, index) => (
                    <div key={index} className="text-sm">{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {validation.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <div key={index} className="text-sm">{warning}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {validation.suggestions.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.suggestions.map((suggestion, index) => (
                    <div key={index} className="text-sm text-amber-800">{suggestion}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      
      {/* Upload Progress */}
      {isUploading && uploadProgress > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading files...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
        </div>
      )}
      
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/5 scale-105"
            : validation.hasValidated && !validation.isValid
            ? "border-red-300 bg-red-50 hover:border-red-400"
            : validation.hasValidated && validation.isValid
            ? "border-green-300 bg-green-50 hover:border-green-400"
            : "border-border bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary hover:bg-primary/5"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!isUploading ? triggerFileSelect : undefined}
        data-testid="file-upload-zone"
      >
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          validation.hasValidated && !validation.isValid
            ? "bg-red-100"
            : validation.hasValidated && validation.isValid
            ? "bg-green-100"
            : "bg-primary/10"
        }`}>
          {validation.hasValidated && !validation.isValid ? (
            <AlertCircle className="text-red-600" size={24} />
          ) : validation.hasValidated && validation.isValid ? (
            <CheckCircle className="text-green-600" size={24} />
          ) : (
            <Upload className="text-primary" size={24} />
          )}
        </div>
        <h4 className="text-lg font-medium text-foreground mb-2">
          {selectedFiles.length > 0 
            ? `${selectedFiles.length} file(s) selected`
            : "Drop your resume files here"
          }
        </h4>
        <p className="text-muted-foreground mb-4">or click to browse from your computer</p>
        <Button 
          type="button"
          disabled={isUploading}
          className={`${
            validation.hasValidated && !validation.isValid
              ? "bg-red-600 hover:bg-red-700"
              : validation.hasValidated && validation.isValid
              ? "bg-green-600 hover:bg-green-700"
              : "bg-primary hover:bg-primary/90"
          }`}
          data-testid="button-select-files"
        >
          {isUploading ? "Uploading..." : "Select Files"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".docx,.doc,.pdf"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file"
        />
        <p className="text-xs text-muted-foreground mt-4">
          Supports DOCX, DOC, and PDF files up to 50MB each
          <br />
          Maximum 10 files per upload, 100MB total
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Selected Files:</h4>
            {validation.hasValidated && (
              <Badge 
                className={validation.isValid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
              >
                {validation.isValid ? (
                  <><CheckCircle size={12} className="mr-1" />Valid</>
                ) : (
                  <><AlertCircle size={12} className="mr-1" />Invalid</>
                )}
              </Badge>
            )}
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => {
              // Individual file validation
              const fileValidation = validateFileUpload((() => {
                const dt = new DataTransfer();
                dt.items.add(file);
                return dt.files;
              })());
              
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    fileValidation.isValid 
                      ? "bg-green-50 border border-green-200" 
                      : "bg-red-50 border border-red-200"
                  }`}
                  data-testid={`selected-file-${index}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileTypeIcon(file)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                        <span>•</span>
                        <span>{file.type || 'Unknown type'}</span>
                        {!fileValidation.isValid && (
                          <>
                            <span>•</span>
                            <span className="text-red-600 font-medium">Issues detected</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {fileValidation.isValid ? (
                      <CheckCircle className="text-green-600" size={16} />
                    ) : (
                      <AlertCircle className="text-red-600" size={16} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      data-testid={`button-remove-${index}`}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* File Summary */}
          <div className="p-3 bg-muted/20 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total files:</span>
              <span className="font-medium">{selectedFiles.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total size:</span>
              <span className="font-medium">
                {(selectedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            {validation.hasValidated && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium ${
                  validation.isValid ? "text-green-600" : "text-red-600"
                }`}>
                  {validation.isValid ? "Ready to upload" : "Issues need attention"}
                </span>
              </div>
            )}
          </div>
          
          <Button
            onClick={handleUpload}
            disabled={isUploading || !validation.isValid}
            className={`w-full ${
              validation.isValid 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-gray-400 hover:bg-gray-500 cursor-not-allowed"
            }`}
            data-testid="button-upload"
          >
            {isUploading 
              ? "Uploading..." 
              : validation.isValid 
              ? `Upload ${selectedFiles.length} file(s)` 
              : "Fix issues to upload"
            }
          </Button>
        </div>
      )}
    </div>
  );
}
