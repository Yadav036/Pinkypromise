import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  User, 
  Fingerprint,
  Award,
  Lock
} from "lucide-react";

interface CertificateViewProps {
  validationResult: {
    isValid: boolean;
    promise: {
      id: string;
      title: string;
      creator: string;
      deliveryDate: string;
      createdAt: string;
    };
    decryptedData?: {
      content: string;
      timestamp: number;
    };
  };
  onClose: () => void;
}

export function CertificateView({ validationResult, onClose }: CertificateViewProps) {
  const { isValid, promise, decryptedData } = validationResult;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Certificate Header */}
      <div className="text-center pb-4 border-b">
        <div className="flex justify-center mb-4">
          {isValid ? (
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <Award className="h-8 w-8 text-green-600" />
            </div>
          ) : (
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Promise Certificate
        </h2>
        <p className="text-slate-600 mt-1">
          Cryptographically Secured Promise Validation
        </p>
      </div>

      {/* Validation Status */}
      <Alert variant={isValid ? "default" : "destructive"}>
        {isValid ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertDescription className="font-medium">
          {isValid 
            ? "✓ This promise certificate is cryptographically valid and verified."
            : "✗ This promise certificate could not be verified or has been tampered with."
          }
        </AlertDescription>
      </Alert>

      {/* Promise Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-primary" />
            Promise Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-500">Promise Title</Label>
              <p className="text-slate-900 font-medium">{promise.title}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Promise ID</Label>
              <p className="text-slate-600 font-mono text-sm">{promise.id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500 flex items-center">
                <User className="h-4 w-4 mr-1" />
                Created By
              </Label>
              <p className="text-slate-900">{promise.creator}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Delivery Date
              </Label>
              <p className="text-slate-900">{formatDate(promise.deliveryDate)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Created On</Label>
              <p className="text-slate-600">{formatDate(promise.createdAt)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Validation Status</Label>
              <Badge variant={isValid ? "default" : "destructive"}>
                {isValid ? "VERIFIED" : "INVALID"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decrypted Content (only for creator) */}
      {decryptedData && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center text-green-800">
              <Lock className="h-5 w-5 mr-2" />
              Decrypted Promise Content
            </CardTitle>
            <CardDescription className="text-green-700">
              This content is only visible to you as the promise creator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <p className="text-slate-900 whitespace-pre-wrap">{decryptedData.content}</p>
            </div>
            <div className="flex items-center text-sm text-green-700">
              <Fingerprint className="h-4 w-4 mr-1" />
              Verified with biometric signature at: {new Date(decryptedData.timestamp).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificate Footer */}
      <div className="bg-slate-50 p-4 rounded-lg text-center">
        <p className="text-sm text-slate-600 mb-2">
          This certificate was generated using WebAuthn biometric authentication
        </p>
        <p className="text-xs text-slate-500">
          PromiseShare • Cryptographically Secured Promise Platform
        </p>
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={onClose} variant="outline">
          Close Certificate
        </Button>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}