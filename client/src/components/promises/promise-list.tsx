import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Shield, 
  Share2, 
  CheckCircle, 
  Clock,
  User,
  Calendar,
  AlertCircle,
  Eye,
  Download,
  Fingerprint
} from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { authenticateForPromise } from "@/lib/webauthn";
import { SharePromiseForm } from "@/components/promises/share-promise-form";
import { CertificateView } from "@/components/promises/certificate-view";

interface PromiseWithDetails {
  id: string;
  title: string;
  content: string;
  deliveryDate: string;
  createdAt: string;
  creator: {
    id: string;
    username: string;
  };
  shares: {
    user: {
      id: string;
      username: string;
    };
  }[];
  certificates: {
    id: string;
    publicKey: string;
  }[];
}

interface PromiseListProps {
  currentUser?: {
    id: string;
    username: string;
    role: string;
  };
}

export function PromiseList({ currentUser }: PromiseListProps) {
  const [selectedPromise, setSelectedPromise] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const authenticateForValidation = async () => {
    if (!currentUser?.username) {
      throw new Error("Current user not available");
    }
    
    const authResult = await authenticateForPromise(currentUser.username);
    if (!authResult.verified) {
      throw new Error("WebAuthn authentication failed");
    }
    return authResult;
  };

  const downloadMutation = useMutation({
    mutationFn: async (promiseId: string) => {
      const response = await fetch(`/api/promises/${promiseId}/download`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      return response.json();
    },
    onSuccess: (result) => {
      // Create and trigger download
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promise-${result.title.replace(/[^a-zA-Z0-9]/g, '_')}-${result.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Promise downloaded!",
        description: "The promise has been saved to your computer as a JSON file.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: promisesData, isLoading, error } = useQuery<{ promises: PromiseWithDetails[] }>({
    queryKey: ["/api/promises"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const validateMutation = useMutation({
    mutationFn: async (promiseId: string) => {
      // First authenticate with WebAuthn to get credential data
      const authResult = await authenticateForValidation();
      
      const response = await fetch(`/api/promises/${promiseId}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ credentialId: authResult.credentialId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Validation failed");
      }

      return response.json();
    },
    onSuccess: (result, promiseId) => {
      setSelectedPromise(promiseId);
      setValidationResult(result);
      toast({
        title: result.isValid ? "Certificate validated!" : "Validation failed",
        description: result.isValid 
          ? "Opening certificate viewer..."
          : "The promise certificate could not be verified.",
        variant: result.isValid ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Validation error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPromiseStatus = (deliveryDate: string) => {
    const now = new Date();
    const delivery = new Date(deliveryDate);
    
    if (delivery < now) {
      return { status: "overdue", color: "destructive" as const, icon: AlertCircle };
    } else if ((delivery.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000) {
      return { status: "due_soon", color: "secondary" as const, icon: Clock };
    } else {
      return { status: "active", color: "default" as const, icon: CheckCircle };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="text-primary mr-2" />
            Your Promises
            <Skeleton className="ml-2 h-6 w-16" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
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
              Failed to load promises. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const promises = promisesData?.promises || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="text-primary mr-2" />
          Secured Promises
          <Badge variant="secondary" className="ml-2">
            {promises.length} promises
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {promises.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No promises created yet</p>
            <p className="text-sm text-slate-400">Create your first secured promise to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {promises.map((promise) => {
              const status = getPromiseStatus(promise.deliveryDate);
              const StatusIcon = status.icon;
              const isCreator = currentUser?.id === promise.creator.id;
              
              return (
                <div
                  key={promise.id}
                  className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-slate-900">{promise.title}</h3>
                        <Badge variant={status.color} className="flex items-center">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                        {promise.content}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-slate-500">
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          by {promise.creator.username} {isCreator && "(you)"}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Due: {formatDate(promise.deliveryDate)}
                        </span>
                        <span>
                          Shared with {promise.shares.length} users
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => validateMutation.mutate(promise.id)}
                        disabled={validateMutation.isPending}
                      >
                        <Fingerprint className="h-4 w-4 mr-1" />
                        {validateMutation.isPending ? "Authenticating..." : "Validate with Fingerprint"}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadMutation.mutate(promise.id)}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>

                      {isCreator && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Share2 className="h-4 w-4 mr-1" />
                              Share
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Share Promise</DialogTitle>
                            </DialogHeader>
                            <SharePromiseForm 
                              promiseId={promise.id} 
                              onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/promises"] });
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      )}

                      {validationResult && selectedPromise === promise.id && (
                        <Dialog open={true} onOpenChange={() => { setValidationResult(null); setSelectedPromise(null); }}>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <CertificateView
                              validationResult={validationResult}
                              onClose={() => { setValidationResult(null); setSelectedPromise(null); }}
                            />
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    
                    <div className="text-xs text-slate-400">
                      Created: {formatDate(promise.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}