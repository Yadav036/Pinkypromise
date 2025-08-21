import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FolderOpen, 
  Download, 
  Trash2, 
  FileText, 
  Image, 
  FileSpreadsheet,
  File as FileIcon,
  AlertCircle
} from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface FileWithUploader {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  uploaderUsername: string;
}

interface FileListProps {
  currentUser?: {
    id: string;
    username: string;
    role: string;
  };
}

export function FileList({ currentUser }: FileListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: filesData, isLoading, error } = useQuery<{ files: FileWithUploader[] }>({
    queryKey: ["/api/files"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File deleted",
        description: "The file has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: "Your file is being downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith("image/")) return <Image className="text-purple-600" />;
    if (mimetype.includes("pdf")) return <FileText className="text-red-600" />;
    if (mimetype.includes("spreadsheet") || mimetype.includes("excel")) 
      return <FileSpreadsheet className="text-green-600" />;
    return <FileIcon className="text-blue-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "1 day ago";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FolderOpen className="text-primary mr-2" />
            Your Files
            <Skeleton className="ml-2 h-6 w-16" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load files. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const files: FileWithUploader[] = filesData?.files || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FolderOpen className="text-primary mr-2" />
          Your Files
          <Badge variant="secondary" className="ml-2">
            {files.length} files
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No files uploaded yet</p>
            <p className="text-sm text-slate-400">Upload your first file to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-slate-100 w-10 h-10 rounded-lg flex items-center justify-center">
                    {getFileIcon(file.mimetype)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{file.originalName}</p>
                    <div className="flex items-center space-x-4 text-sm text-slate-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDate(file.uploadedAt)}</span>
                      <span className={file.uploaderUsername === currentUser?.username ? "text-green-600" : "text-blue-600"}>
                        by {file.uploaderUsername}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file.id, file.originalName)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {currentUser?.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(file.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
