import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Calendar, AlertCircle, User, Fingerprint } from "lucide-react";
import { insertPromiseSchema } from "@shared/schema";
import { getAuthHeaders } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { authenticateForPromise, isWebAuthnSupported, registerWebAuthnForCurrentUser } from "@/lib/webauthn";
import type { InsertPromise } from "@shared/schema";

interface PromiseFormProps {
  onSuccess?: () => void;
}

export function PromiseForm({ onSuccess }: PromiseFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [webAuthnRegistered, setWebAuthnRegistered] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: usersData } = useQuery<{ users: { id: string; username: string; role: string }[] }>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: currentUser } = useQuery<{ user: { id: string; username: string } }>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Check if WebAuthn is already registered
  const { data: credentialsData } = useQuery<{ credentials: any[] }>({
    queryKey: ["/api/auth/credentials"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isWebAuthnSupported(),
  });

  // Update webAuthnRegistered state when credentials data changes
  React.useEffect(() => {
    if (credentialsData) {
      setWebAuthnRegistered(credentialsData.credentials.length > 0);
    }
  }, [credentialsData]);

  const registerWebAuthn = async () => {
    try {
      setIsRegistering(true);
      const result = await registerWebAuthnForCurrentUser();
      if (result.verified) {
        setWebAuthnRegistered(true);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/credentials"] });
        toast({
          title: "Fingerprint registered!",
          description: "You can now create promises with your fingerprint.",
        });
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Failed to register fingerprint",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const form = useForm({
    resolver: zodResolver(insertPromiseSchema),
    defaultValues: {
      title: "",
      content: "",
      metadata: {},
      deliveryDate: "",
      recipientId: "",
    },
  });

  const createPromiseMutation = useMutation({
    mutationFn: async (data: InsertPromise) => {
      if (!isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported in this environment. Please use HTTPS or localhost.");
      }

      if (!currentUser?.user?.username) {
        throw new Error("User information not available");
      }

      setIsAuthenticating(true);
      
      try {
        // Authenticate with WebAuthn to get fingerprint data
        const authResult = await authenticateForPromise(currentUser.user.username);
        
        if (!authResult.verified) {
          throw new Error("WebAuthn authentication failed");
        }

        // Create promise with WebAuthn fingerprint data
        const response = await fetch("/api/promises", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            promiseData: data,
            fingerprintData: authResult.fingerprintData,
            credentialId: authResult.credentialId
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create promise");
        }

        return response.json();
      } finally {
        setIsAuthenticating(false);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/promises"] });
      toast({
        title: "Promise created successfully!",
        description: "Your promise has been encrypted and secured. You can optionally sign it with WebAuthn for enhanced security.",
      });
      form.reset();
      onSuccess?.();
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const onSubmit = (data: any) => {
    setError(null);
    createPromiseMutation.mutate(data);
  };

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="text-primary mr-2" />
          Create Secured Promise
        </CardTitle>
        <CardDescription>
          Your promise will be secured with your biometric fingerprint and cannot be modified once created
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Promise Title</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="e.g., Project Delivery Promise"
              disabled={createPromiseMutation.isPending}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Promise Content</Label>
            <Textarea
              id="content"
              {...form.register("content")}
              placeholder="I promise to deliver the project on time with all specified features..."
              rows={4}
              disabled={createPromiseMutation.isPending}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-red-600">{form.formState.errors.content.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryDate" className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Delivery Date
            </Label>
            <Input
              id="deliveryDate"
              type="date"
              min={today}
              {...form.register("deliveryDate")}
              disabled={createPromiseMutation.isPending}
            />
            {form.formState.errors.deliveryDate && (
              <p className="text-sm text-red-600">{form.formState.errors.deliveryDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient" className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              Recipient
            </Label>
            <Select
              onValueChange={(value) => form.setValue("recipientId", value)}
              disabled={createPromiseMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {usersData?.users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Recipient is required for promise creation
            </p>
          </div>

          {!isWebAuthnSupported() ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                WebAuthn is not supported in this environment. Please use HTTPS or localhost with a compatible browser.
              </AlertDescription>
            </Alert>
          ) : webAuthnRegistered === false ? (
            <Alert>
              <Fingerprint className="h-4 w-4" />
              <AlertDescription>
                You need to register your fingerprint first to create promises.
                <Button 
                  variant="link" 
                  className="ml-2 p-0 h-auto"
                  onClick={registerWebAuthn}
                  disabled={isRegistering}
                >
                  {isRegistering ? "Registering..." : "Register Fingerprint"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Fingerprint className="h-4 w-4" />
              <AlertDescription>
                This promise will be secured with your biometric fingerprint and cannot be modified after creation.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={createPromiseMutation.isPending || isAuthenticating || !isWebAuthnSupported() || webAuthnRegistered === false}
          >
            {isAuthenticating ? (
              <>
                <Fingerprint className="h-4 w-4 mr-2" />
                Please use your fingerprint...
              </>
            ) : createPromiseMutation.isPending ? (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Creating Secured Promise...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4 mr-2" />
                Create Promise with Fingerprint
              </>
            )}
          </Button>
        </form>
      </CardContent>
      
    </Card>
  );
}