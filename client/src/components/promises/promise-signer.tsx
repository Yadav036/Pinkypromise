import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Download, CheckCircle, Loader2 } from "lucide-react";
import { startAuthentication } from '@simplewebauthn/browser';
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface PromiseSignerProps {
  promise: {
    id: string;
    title: string;
    content: string;
    deliveryDate: string;
    createdAt: string;
    creator: {
      id: string;
      username: string;
    };
  };
  signingChallenge: string;
  onClose?: () => void;
}

export function PromiseSigner({ promise, signingChallenge, onClose }: PromiseSignerProps) {
  const [isSigning, setIsSigning] = useState(false);
  const [isDownloadReady, setIsDownloadReady] = useState(false);
  const [signedPromise, setSignedPromise] = useState<any>(null);
  const [downloadFileName, setDownloadFileName] = useState("");
  const { toast } = useToast();

  const handleWebAuthnSigning = async () => {
    try {
      setIsSigning(true);

      // Get user's credentials for authentication
      const credentialsResponse = await fetch('/api/auth/webauthn/authenticate/begin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ username: promise.creator.username }),
      });

      if (!credentialsResponse.ok) {
        throw new Error('Failed to start authentication');
      }

      const credentialOptions = await credentialsResponse.json();
      
      // Override challenge with our promise-specific challenge
      credentialOptions.challenge = signingChallenge;

      // Perform WebAuthn authentication with promise challenge
      const credential = await startAuthentication(credentialOptions);

      // Extract public key from stored credentials
      const publicKeyResponse = await fetch('/api/auth/credentials', {
        headers: getAuthHeaders(),
      });
      
      if (!publicKeyResponse.ok) {
        throw new Error('Failed to get public key');
      }

      const { credentials } = await publicKeyResponse.json();
      const userCredential = credentials[0]; // Use first credential

      // Send signature to backend for signed promise creation
      const signResponse = await fetch(`/api/promises/${promise.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          signature: {
            credentialId: credential.id,
            clientDataJSON: credential.response.clientDataJSON,
            authenticatorData: credential.response.authenticatorData,
            signature: credential.response.signature,
            userHandle: credential.response.userHandle,
          },
          publicKey: userCredential.publicKey,
        }),
      });

      if (!signResponse.ok) {
        const error = await signResponse.json();
        throw new Error(error.error || 'Failed to sign promise');
      }

      const result = await signResponse.json();
      setSignedPromise(result.signedPromise);
      setDownloadFileName(result.downloadFileName);
      setIsDownloadReady(true);

      toast({
        title: "Promise signed successfully!",
        description: "Your cryptographically signed promise is ready for download.",
      });

    } catch (error) {
      console.error('WebAuthn signing error:', error);
      toast({
        title: "Signing failed",
        description: error instanceof Error ? error.message : "Failed to sign promise with passkey",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const downloadSignedPromise = () => {
    if (!signedPromise) return;

    const blob = new Blob([JSON.stringify(signedPromise, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download complete!",
      description: "Your signed promise has been saved to your device.",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Sign Your Promise
        </h2>
        <p className="text-slate-600 mt-1">
          Create a cryptographically signed, downloadable promise file
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promise Details</CardTitle>
          <CardDescription>
            This promise will be signed with your biometric passkey for non-repudiation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-500">Title</label>
              <p className="text-slate-900 font-medium">{promise.title}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-500">Delivery Date</label>
              <p className="text-slate-900">{formatDate(promise.deliveryDate)}</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Promise Content</label>
            <p className="text-slate-900 p-3 bg-slate-50 rounded-lg mt-1">{promise.content}</p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Your promise will be cryptographically signed with your passkey and encrypted for secure storage.
          The signed file can be verified on any device without requiring database access.
        </AlertDescription>
      </Alert>

      {!isDownloadReady ? (
        <div className="flex justify-center pt-4">
          <Button 
            onClick={handleWebAuthnSigning}
            disabled={isSigning}
            size="lg"
            className="min-w-48"
          >
            {isSigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing with Passkey...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Sign with Passkey
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✓ Promise successfully signed and encrypted! Ready for download.
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-center gap-4 pt-4">
            <Button 
              onClick={downloadSignedPromise}
              size="lg"
              className="min-w-48"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Signed Promise
            </Button>
            
            {onClose && (
              <Button 
                onClick={onClose}
                variant="outline"
                size="lg"
              >
                Close
              </Button>
            )}
          </div>
          
          <div className="text-center text-sm text-slate-600">
            <p>File: <code className="bg-slate-100 px-2 py-1 rounded">{downloadFileName}</code></p>
            <p className="mt-1">This file contains your encrypted promise and cryptographic proof of authenticity.</p>
          </div>
        </div>
      )}
    </div>
  );
}