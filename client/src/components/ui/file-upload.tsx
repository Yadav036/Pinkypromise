import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, File, X, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onUploadSuccess?: () => void;
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "Upload successful!",
        description: "Your file has been uploaded securely.",
      });
      onUploadSuccess?.();
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      setError(error.message);
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) {
      setError("No valid files selected");
      return;
    }

    const file = acceptedFiles[0];
    
    // Simulate upload progress
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    uploadMutation.mutate(file);

    // Clear progress interval when upload completes
    setTimeout(() => {
      clearInterval(progressInterval);
      setUploadProgress(100);
    }, 2000);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDropRejected: (rejectedFiles: any[]) => {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === "file-too-large") {
        setError("File is too large. Maximum size is 10MB.");
      } else {
        setError("File was rejected. Please try a different file.");
      }
    },
  });

  return (
    <Card>
      <CardContent className="p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Upload className="text-primary mr-2" />
          Upload Files
        </h4>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? "border-primary bg-primary/5" 
              : "border-slate-300 hover:border-primary/40"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-slate-600 mb-2">Drop the file here...</p>
          ) : (
            <>
              <p className="text-slate-600 mb-2">Click to upload files or drag and drop</p>
              <p className="text-sm text-slate-500">Supports multiple file formats (max 10MB)</p>
            </>
          )}
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-slate-500 flex items-center">
            <File className="h-4 w-4 mr-1" />
            Files are secured with your JWT token
          </div>
          <Button 
            onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
            disabled={uploadMutation.isPending}
            size="sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            Add Files
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
