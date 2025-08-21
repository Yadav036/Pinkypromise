import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PasswordRegister } from "@/components/auth/webauthn-register";
import { PasswordLogin } from "@/components/auth/webauthn-login";
import { getAuthToken } from "@/lib/auth";

export default function Auth() {
  const [location, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    // Check if user is already authenticated
    if (getAuthToken()) {
      setLocation("/dashboard");
      return;
    }

    // Parse mode from URL params
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    if (urlMode === "register" || urlMode === "login") {
      setMode(urlMode);
    }
  }, [setLocation]);

  const handleSuccess = () => {
    setLocation("/dashboard");
  };

  const toggleMode = () => {
    const newMode = mode === "login" ? "register" : "login";
    setMode(newMode);
    setLocation(`/auth?mode=${newMode}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {mode === "register" ? (
          <PasswordRegister onSuccess={handleSuccess} />
        ) : (
          <PasswordLogin onSuccess={handleSuccess} />
        )}
        
        <div className="mt-6 text-center">
          <Button variant="link" onClick={toggleMode}>
            {mode === "login" 
              ? "Don't have an account? Register" 
              : "Already have an account? Sign in"
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
