import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { apiRequest } from "./queryClient";

export interface RegistrationOptions {
  username: string;
  role: "admin" | "user";
}

export interface LoginOptions {
  username: string;
}

export interface AuthResult {
  verified: boolean;
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export const registerWithWebAuthn = async (options: RegistrationOptions): Promise<AuthResult> => {
  try {
    // Get registration options from server
    const optionsResponse = await apiRequest("POST", "/api/auth/register/options", options);
    const registrationOptions = await optionsResponse.json();

    // Start WebAuthn registration
    const credential = await startRegistration(registrationOptions);

    // Verify registration with server
    const verificationResponse = await apiRequest("POST", "/api/auth/register/verify", {
      username: options.username,
      role: options.role,
      credential,
    });

    const result = await verificationResponse.json();

    if (result.verified) {
      // Store token in localStorage
      localStorage.setItem("authToken", result.token);
      return result;
    } else {
      throw new Error("Registration verification failed");
    }
  } catch (error) {
    console.error("WebAuthn registration error:", error);
    throw error;
  }
};

export const loginWithWebAuthn = async (options: LoginOptions): Promise<AuthResult> => {
  try {
    // Get authentication options from server
    const optionsResponse = await apiRequest("POST", "/api/auth/login/options", options);
    const authenticationOptions = await optionsResponse.json();

    // Start WebAuthn authentication
    const credential = await startAuthentication(authenticationOptions);

    // Verify authentication with server
    const verificationResponse = await apiRequest("POST", "/api/auth/login/verify", {
      username: options.username,
      credential,
    });

    const result = await verificationResponse.json();

    if (result.verified) {
      // Store token in localStorage
      localStorage.setItem("authToken", result.token);
      return result;
    } else {
      throw new Error("Authentication verification failed");
    }
  } catch (error) {
    console.error("WebAuthn authentication error:", error);
    throw error;
  }
};

// Register WebAuthn for existing user
export const registerWebAuthnForCurrentUser = async (): Promise<{ verified: boolean }> => {
  try {
    // Get registration options
    const optionsResponse = await apiRequest("POST", "/api/auth/webauthn/register");
    const registrationOptions = await optionsResponse.json();

    // Start WebAuthn registration
    const credential = await startRegistration(registrationOptions);

    // Verify registration
    const verificationResponse = await apiRequest("POST", "/api/auth/webauthn/register/verify", { credential });
    const result = await verificationResponse.json();

    return {
      verified: result.verified
    };
  } catch (error) {
    console.error("WebAuthn registration error:", error);
    throw error;
  }
};

// WebAuthn authentication for promise creation
export const authenticateForPromise = async (username: string): Promise<{ verified: boolean; fingerprintData: string; credentialId: string }> => {
  try {
    // Get authentication options
    const optionsResponse = await apiRequest("POST", "/api/auth/webauthn/authenticate/begin", { username });
    const authenticationOptions = await optionsResponse.json();

    // Start WebAuthn authentication
    const credential = await startAuthentication(authenticationOptions);

    // Verify authentication
    const verificationResponse = await apiRequest("POST", "/api/auth/webauthn/authenticate/verify", { credential });
    const result = await verificationResponse.json();

    if (result.verified) {
      return {
        verified: true,
        fingerprintData: result.fingerprintData,
        credentialId: result.credentialId
      };
    } else {
      throw new Error("Authentication verification failed");
    }
  } catch (error) {
    console.error("WebAuthn promise authentication error:", error);
    throw error;
  }
};

export const isWebAuthnSupported = (): boolean => {
  return (
    window.PublicKeyCredential !== undefined &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
  );
};
