import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Shield,
  AlertTriangle,
  Loader2,
  Award
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PromiseVerifier() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setVerificationResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json']
    },
    maxFiles: 1,
    multiple: false
  });

  const verifyPromise = async () => {
    if (!uploadedFile) return;

    try {
      setIsVerifying(true);

      // Read file content
      const fileContent = await uploadedFile.text();
      const signedPromise = JSON.parse(fileContent);

      // Send to verification endpoint
      const response = await fetch('/api/verify-promise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signedPromise }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Verification failed');
      }

      const result = await response.json();
      setVerificationResult(result);

      toast({
        title: result.verification.isValid ? "Promise verified!" : "Verification failed",
        description: result.verification.isValid 
          ? `Signed by ${result.promise.creator}` 
          : "Promise could not be verified",
        variant: result.verification.isValid ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification error",
        description: error instanceof Error ? error.message : "Failed to verify promise",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const resetVerifier = () => {
    setUploadedFile(null);
    setVerificationResult(null);
  };

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center pb-4 border-b">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Verify Promise
        </h2>
        <p className="text-slate-600 mt-1">
          Upload a signed promise file to verify its authenticity and integrity
        </p>
      </div>

      {!verificationResult ? (
        <>
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Upload Promise File
              </CardTitle>
              <CardDescription>
                Select or drag a .json promise file to verify its cryptographic signature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-300 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                {isDragActive ? (
                  <p className="text-slate-600">Drop the promise file here...</p>
                ) : (
                  <div>
                    <p className="text-slate-600 mb-2">
                      Drag and drop a promise file here, or click to select
                    </p>
                    <p className="text-sm text-slate-500">
                      Supports .json files only
                    </p>
                  </div>
                )}
              </div>

              {uploadedFile && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-primary mr-2" />
                      <div>
                        <p className="font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-slate-500">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={verifyPromise}
                        disabled={isVerifying}
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 mr-2" />
                            Verify Promise
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={resetVerifier}
                        variant="outline"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Information */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Promise verification checks cryptographic signatures, data integrity, and WebAuthn authentication.
              No internet connection to a database is required - all verification is done locally.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        /* Verification Results */
        <div className="space-y-6">
          {/* Verification Status */}
          <Card className={verificationResult.verification.isValid ? 'border-green-200' : 'border-red-200'}>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {verificationResult.verification.isValid ? (
                  <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Award className="h-8 w-8 text-green-600" />
                  </div>
                ) : (
                  <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                )}
              </div>
              <CardTitle className={verificationResult.verification.isValid ? 'text-green-800' : 'text-red-800'}>
                {verificationResult.verification.isValid ? 'Promise Verified' : 'Verification Failed'}
              </CardTitle>
              <CardDescription>
                {verificationResult.verification.isValid 
                  ? `✅ Valid. Signed by ${verificationResult.verification.creator} with cryptographic proof.`
                  : `❌ Invalid. ${verificationResult.verification.errorDetails || 'Signature does not match, promise was modified, or not signed by a registered user.'}`
                }
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Promise Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Promise Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-500">Title</label>
                  <p className="text-slate-900 font-medium">{verificationResult.promise.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Creator</label>
                  <p className="text-slate-900">{verificationResult.promise.creator}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Delivery Date</label>
                  <p className="text-slate-900">{formatDate(verificationResult.promise.deliveryDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Created</label>
                  <p className="text-slate-900">{formatDate(verificationResult.promise.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Verification Status</label>
                  <Badge variant={verificationResult.verification.isValid ? "default" : "destructive"}>
                    {verificationResult.verification.isValid ? "VERIFIED" : "INVALID"}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Promise ID</label>
                  <p className="text-slate-600 font-mono text-sm">{verificationResult.promise.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center text-slate-700">
                <Shield className="h-5 w-5 mr-2" />
                Verification Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center">
                  {verificationResult.verification.isChallengeValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mr-2" />
                  )}
                  <span>Challenge Valid</span>
                </div>
                <div className="flex items-center">
                  {verificationResult.verification.isSignatureValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mr-2" />
                  )}
                  <span>Signature Valid</span>
                </div>
                <div className="flex items-center">
                  {verificationResult.verification.isDataIntact ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mr-2" />
                  )}
                  <span>Data Intact</span>
                </div>
              </div>
              
              {verificationResult.verification.errorDetails && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Technical Details:</strong> {verificationResult.verification.errorDetails}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center pt-4">
            <Button onClick={resetVerifier} variant="outline" size="lg">
              Verify Another Promise
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}