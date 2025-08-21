import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { PromiseCrypto } from "./crypto";
import { WebAuthnPromiseService } from "./webauthn-promise";
import { registerUser, loginUser, authenticateJWT } from "./auth";
import crypto from "crypto";
import { insertUserSchema, insertPromiseSchema, promiseShareSchema } from "@shared/schema";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from "@simplewebauthn/server";

// WebAuthn configuration
const RP_NAME = "SecureShare";
const RP_ID = "localhost";
const ORIGIN = "http://localhost:2000";

// In-memory challenge storage
const challenges = new Map<string, string>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Password-based registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log("Registration request:", { username, password: "***" });
      
      const result = await registerUser(username, password);
      console.log("Registration successful:", { userId: result.user.id, username: result.user.username });
      
      res.json(result);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Registration failed" });
    }
  });

  // Password-based login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log("Login request:", { username, password: "***" });
      
      const result = await loginUser(username, password);
      console.log("Login successful:", { userId: result.user.id, username: result.user.username });
      
      res.json(result);
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticateJWT, async (req: any, res) => {
    try {
      const user = await db.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, username: true, createdAt: true }
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ user });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Get all users
  app.get("/api/users", authenticateJWT, async (req: any, res) => {
    try {
      const users = await db.user.findMany({
        select: { id: true, username: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      
      res.json({ users });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // WebAuthn Registration for existing users
  app.post("/api/auth/webauthn/register", authenticateJWT, async (req: any, res) => {
    try {
      const user = await db.user.findUnique({
        where: { id: req.user.id }
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user already has credentials
      const existingCredentials = await db.credential.findMany({
        where: { userId: user.id }
      });
      
      if (existingCredentials.length > 0) {
        return res.json({ success: true, message: "WebAuthn already registered" });
      }
      
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: new TextEncoder().encode(user.username),
        userName: user.username,
        userDisplayName: user.username,
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        supportedAlgorithmIDs: [-7, -257],
      });
      
      // Store challenge
      challenges.set(`${req.user.id}_register`, options.challenge);
      
      res.json(options);
    } catch (error) {
      console.error("WebAuthn registration error:", error);
      res.status(400).json({ error: "Failed to start WebAuthn registration" });
    }
  });

  // WebAuthn Registration Verification
  app.post("/api/auth/webauthn/register/verify", authenticateJWT, async (req: any, res) => {
    try {
      const { credential } = req.body;
      
      const expectedChallenge = challenges.get(`${req.user.id}_register`);
      if (!expectedChallenge) {
        return res.status(400).json({ error: "No challenge found for user" });
      }
      
      const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });
      
      if (verification.verified && verification.registrationInfo) {
        // Store credential
        await db.credential.create({
          data: {
            id: verification.registrationInfo.credential.id,
            userId: req.user.id,
            publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
            counter: verification.registrationInfo.credential.counter,
          }
        });
        
        // Clean up challenge
        challenges.delete(`${req.user.id}_register`);
        
        res.json({ verified: true, message: "WebAuthn registration successful" });
      } else {
        res.status(400).json({ error: "Registration verification failed" });
      }
    } catch (error) {
      console.error("WebAuthn registration verification error:", error);
      res.status(400).json({ error: "Registration verification failed" });
    }
  });

  // WebAuthn Authentication Options (for promise signing)
  app.post("/api/auth/webauthn/authenticate/begin", authenticateJWT, async (req: any, res) => {
    try {
      const { username } = req.body;
      
      const user = await db.user.findUnique({
        where: { username }
      });
      
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const userCredentials = await db.credential.findMany({
        where: { userId: user.id }
      });
      
      const allowCredentials = userCredentials.map(cred => ({
        id: cred.id,
        type: "public-key" as const,
      }));
      
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials,
        userVerification: "required",
      });
      
      // Store challenge for this user session
      challenges.set(`${req.user.id}_auth`, options.challenge);
      
      res.json(options);
    } catch (error) {
      console.error("WebAuthn auth options error:", error);
      res.status(400).json({ error: "Failed to generate authentication options" });
    }
  });

  // WebAuthn Authentication Verification (for promise signing)
  app.post("/api/auth/webauthn/authenticate/verify", authenticateJWT, async (req: any, res) => {
    try {
      const { credential } = req.body;
      
      const expectedChallenge = challenges.get(`${req.user.id}_auth`);
      if (!expectedChallenge) {
        return res.status(400).json({ error: "No challenge found for user" });
      }
      
      const dbCredential = await db.credential.findUnique({
        where: { id: credential.id }
      });
      
      if (!dbCredential || dbCredential.userId !== req.user.id) {
        return res.status(400).json({ error: "Credential not found" });
      }
      
      const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: dbCredential.id,
          publicKey: Buffer.from(dbCredential.publicKey, 'base64'),
          counter: dbCredential.counter,
        },
      });
      
      if (verification.verified) {
        // Update counter
        await db.credential.update({
          where: { id: dbCredential.id },
          data: { counter: verification.authenticationInfo.newCounter }
        });
        
        // Clean up challenge
        challenges.delete(`${req.user.id}_auth`);
        
        // Return fingerprint data for promise creation
        res.json({ 
          verified: true,
          fingerprintData: credential.response.signature,
          credentialId: dbCredential.id,
          publicKey: dbCredential.publicKey,
          webauthnCredential: credential
        });
      } else {
        res.status(400).json({ error: "Authentication verification failed" });
      }
    } catch (error) {
      console.error("WebAuthn auth verification error:", error);
      res.status(400).json({ error: "Authentication verification failed" });
    }
  });

  // Get user credentials
  app.get("/api/auth/credentials", authenticateJWT, async (req: any, res) => {
    try {
      const credentials = await db.credential.findMany({
        where: { userId: req.user.id },
        select: { id: true, publicKey: true, counter: true, createdAt: true }
      });
      
      res.json({ credentials });
    } catch (error) {
      console.error("Get credentials error:", error);
      res.status(500).json({ error: "Failed to get credentials" });
    }
  });

  // Create Promise (now requires WebAuthn fingerprint)
  app.post("/api/promises", authenticateJWT, async (req: any, res) => {
    try {
      const { promiseData, fingerprintData, credentialId } = req.body;
      
      if (!fingerprintData || !credentialId) {
        return res.status(400).json({ error: "WebAuthn fingerprint data and credential ID are required for promise creation" });
      }
      
      const validatedData = insertPromiseSchema.parse(promiseData);
      console.log("Promise creation request with WebAuthn:", JSON.stringify(validatedData, null, 2));
      
      // Generate RSA key pair for this promise
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
      });

      // Store credential ID instead of hashed fingerprint for validation
      const hashedFingerprint = PromiseCrypto.hashFingerprint(credentialId);

      // Encrypt promise with content + private key + fingerprint
      const encryptedData = PromiseCrypto.encryptPromise(
        validatedData.content,
        keyPair.privateKey,
        fingerprintData
      );
      
      const promise = await db.promise.create({
        data: {
          title: validatedData.title,
          content: validatedData.content,
          metadata: validatedData.metadata,
          encryptedData,
          fingerprint: hashedFingerprint,
          credentialId,
          deliveryDate: validatedData.deliveryDate,
          recipientId: validatedData.recipientId,
          creatorId: req.user.id,
        },
        include: {
          creator: {
            select: { id: true, username: true }
          },
          recipient: {
            select: { id: true, username: true }
          },
        }
      });
      
      console.log("Promise created successfully:", JSON.stringify({
        id: promise.id,
        title: promise.title,
        creator: promise.creator.username,
        recipient: promise.recipient?.username
      }, null, 2));

      // Generate certificate
      const certificate = PromiseCrypto.generateCertificate(
        promise.id,
        keyPair.publicKey,
        hashedFingerprint
      );
      
      await db.promiseCertificate.create({
        data: {
          promiseId: promise.id,
          certificate,
          publicKey: keyPair.publicKey,
        }
      });
      
      res.json({ 
        promise, 
        certificate,
        message: "Promise created successfully with WebAuthn fingerprint authentication!"
      });
    } catch (error) {
      console.error("Promise creation error:", error);
      res.status(400).json({ error: "Failed to create promise" });
    }
  });

  // Share Promise
  app.post("/api/promises/:id/share", authenticateJWT, async (req: any, res) => {
    try {
      const promiseId = req.params.id;
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: "userIds array is required" });
      }
      
      // Check if promise exists and user owns it
      const promise = await db.promise.findFirst({
        where: {
          id: promiseId,
          creatorId: req.user.id,
        }
      });
      
      if (!promise) {
        return res.status(404).json({ error: "Promise not found or access denied" });
      }
      
      // Create shares for each user
      const shares = await Promise.all(
        userIds.map(userId =>
          db.promiseShare.upsert({
            where: {
              promiseId_userId: {
                promiseId,
                userId,
              }
            },
            update: {},
            create: {
              promiseId,
              userId,
              canValidate: true,
            }
          })
        )
      );
      
      res.json({ shares });
    } catch (error) {
      console.error("Promise share error:", error);
      res.status(400).json({ error: "Failed to share promise" });
    }
  });

  // Sign Promise with WebAuthn (for downloadable file)
  app.post("/api/promises/:id/sign", authenticateJWT, async (req: any, res) => {
    try {
      const promiseId = req.params.id;
      const { signature, publicKey } = req.body;

      // Get promise with creator details
      const promise = await db.promise.findFirst({
        where: {
          id: promiseId,
          creatorId: req.user.id,
        },
        include: {
          creator: true,
        }
      });

      if (!promise) {
        return res.status(404).json({ error: "Promise not found or access denied" });
      }

      // Generate challenge for this specific promise
      const challenge = WebAuthnPromiseService.generateSigningChallenge({
        id: promise.id,
        title: promise.title,
        content: promise.content,
        deliveryDate: promise.deliveryDate?.toISOString() || "",
        creatorId: promise.creatorId
      });

      // Create signed promise file
      const signedPromise = WebAuthnPromiseService.createSignedPromiseFile(
        promise,
        signature,
        publicKey,
        challenge
      );

      res.json({ 
        signedPromise,
        downloadFileName: `promise-${promise.title.replace(/[^a-zA-Z0-9]/g, '_')}-${promise.id}.json`
      });
    } catch (error) {
      console.error("Promise signing error:", error);
      res.status(400).json({ error: "Failed to sign promise" });
    }
  });

  // Verify Promise File (standalone verification)
  app.post("/api/verify-promise", async (req, res) => {
    try {
      const { signedPromise } = req.body;

      if (!signedPromise) {
        return res.status(400).json({ error: "No promise data provided" });
      }

      // Check if this is a downloaded promise file (plain format) or a signed promise with WebAuthn
      const isSignedPromise = signedPromise.signature && signedPromise.signature.clientDataJSON;
      
      let verificationResult;
      
      if (isSignedPromise) {
        // This is a signed promise with WebAuthn data
        verificationResult = await WebAuthnPromiseService.verifySignedPromise(signedPromise);
      } else {
        // This is a plain downloaded promise file - verify using stored data
        if (!signedPromise.verification || !signedPromise.verification.fingerprint) {
          return res.json({
            verification: {
              isValid: false,
              isSignatureValid: false,
              isChallengeValid: false,
              isDataIntact: true,
              errorDetails: "Missing verification data in promise file"
            },
            promise: {
              id: signedPromise.id,
              title: signedPromise.title,
              creator: signedPromise.creator?.username || "Unknown",
              deliveryDate: signedPromise.deliveryDate,
              createdAt: signedPromise.createdAt,
            }
          });
        }
        
        // Check if the promise exists in the database with matching fingerprint
        const dbPromise = await db.promise.findUnique({
          where: { id: signedPromise.id },
          include: {
            creator: { select: { id: true, username: true } }
          }
        });
        
        if (!dbPromise) {
          verificationResult = {
            isValid: false,
            isSignatureValid: false,
            isChallengeValid: false,
            isDataIntact: false,
            errorDetails: "Promise not found in database"
          };
        } else {
          // Verify the fingerprint matches
          const isValid = dbPromise.fingerprint === signedPromise.verification.fingerprint;
          
          verificationResult = {
            isValid,
            isSignatureValid: isValid,
            isChallengeValid: isValid,
            isDataIntact: true,
            creator: dbPromise.creator.username,
            errorDetails: isValid ? undefined : "Promise fingerprint does not match database record"
          };
        }
      }

      res.json({
        verification: verificationResult,
        promise: {
          id: signedPromise.id,
          title: signedPromise.title,
          creator: verificationResult.creator || signedPromise.creator?.username || "Unknown",
          deliveryDate: signedPromise.deliveryDate,
          createdAt: signedPromise.createdAt,
        }
      });
    } catch (error) {
      console.error("Promise verification error:", error);
      res.status(400).json({ 
        error: "Failed to verify promise",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get Promises (both created and received)
  app.get("/api/promises", authenticateJWT, async (req: any, res) => {
    try {
      const promises = await db.promise.findMany({
        where: {
          OR: [
            { creatorId: req.user.id },
            { recipientId: req.user.id },
            {
              shares: {
                some: {
                  userId: req.user.id,
                }
              }
            }
          ]
        },
        include: {
          creator: { select: { id: true, username: true } },
          recipient: { select: { id: true, username: true } },
          shares: {
            include: {
              user: { select: { id: true, username: true } },
            }
          },
          certificates: true,
        },
        orderBy: {
          createdAt: 'desc',
        }
      });
      
      console.log(`Found ${promises.length} promises for user ${req.user.id}`);
      res.json({ promises });
    } catch (error) {
      console.error("Get promises error:", error);
      res.status(500).json({ error: "Failed to get promises" });
    }
  });

  // Validate Promise using WebAuthn fingerprint
  app.post("/api/promises/:id/validate", authenticateJWT, async (req: any, res) => {
    try {
      const promiseId = req.params.id;
      const { credentialId } = req.body;
      
      if (!credentialId) {
        return res.status(400).json({ error: "WebAuthn credential ID is required for validation" });
      }
      
      const promise = await db.promise.findFirst({
        where: {
          id: promiseId,
          OR: [
            { creatorId: req.user.id },
            { shares: { some: { userId: req.user.id } } }
          ]
        },
        include: {
          creator: true,
          certificates: true,
        }
      });
      
      if (!promise) {
        return res.status(404).json({ error: "Promise not found or access denied" });
      }
      
      // Validate using stored credential ID
      const isValid = promise.credentialId === credentialId;
      
      let decryptedData = null;
      if (isValid && req.user.id === promise.creatorId) {
        try {
          // Only decrypt for the creator when valid
          const decrypted = PromiseCrypto.decryptPromise(promise.encryptedData);
          decryptedData = decrypted.content;
        } catch (error) {
          console.error("Decryption error:", error);
        }
      }
      
      res.json({
        isValid,
        promise: {
          id: promise.id,
          title: promise.title,
          creator: promise.creator.username,
          deliveryDate: promise.deliveryDate,
          createdAt: promise.createdAt,
        },
        decryptedData
      });
    } catch (error) {
      console.error("Promise validation error:", error);
      res.status(400).json({ error: "Failed to validate promise" });
    }
  });

  // Download Promise as JSON
  app.get("/api/promises/:id/download", authenticateJWT, async (req: any, res) => {
    try {
      const promiseId = req.params.id;
      
      const promise = await db.promise.findFirst({
        where: {
          id: promiseId,
          OR: [
            { creatorId: req.user.id },
            { recipientId: req.user.id },
            { shares: { some: { userId: req.user.id } } }
          ]
        },
        include: {
          creator: { select: { id: true, username: true } },
          recipient: { select: { id: true, username: true } },
          certificates: true,
        }
      });
      
      if (!promise) {
        return res.status(404).json({ error: "Promise not found or access denied" });
      }
      
      // Create downloadable promise object
      const downloadablePromise = {
        id: promise.id,
        title: promise.title,
        content: promise.content,
        creator: {
          id: promise.creator.id,
          username: promise.creator.username
        },
        recipient: promise.recipient ? {
          id: promise.recipient.id,
          username: promise.recipient.username
        } : null,
        deliveryDate: promise.deliveryDate,
        createdAt: promise.createdAt,
        certificates: promise.certificates,
        verification: {
          fingerprint: promise.fingerprint,
          encryptedData: promise.encryptedData
        },
        metadata: promise.metadata
      };
      
      // Set headers for file download
      const fileName = `promise-${promise.title.replace(/[^a-zA-Z0-9]/g, '_')}-${promise.id}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/json');
      
      res.json(downloadablePromise);
    } catch (error) {
      console.error("Promise download error:", error);
      res.status(500).json({ error: "Failed to download promise" });
    }
  });

  return createServer(app);
}