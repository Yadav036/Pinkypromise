import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { PromiseCrypto } from "./crypto";
import { WebAuthnPromiseService } from "./webauthn-promise";
import { registerUser, loginUser, authenticateJWT } from "./auth";
import crypto from "crypto";
import { insertUserSchema, insertPromiseSchema, promiseShareSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // WebAuthn Registration - Generate Options
  app.post("/api/auth/register/options", async (req, res) => {
    try {
      const { username, role } = req.body;
      
      // Validate input
      const validatedData = insertUserSchema.parse({ username, role });
      
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { username: validatedData.username }
      });
      
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: new TextEncoder().encode(validatedData.username),
        userName: validatedData.username,
        userDisplayName: validatedData.username,
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        supportedAlgorithmIDs: [-7, -257],
      });
      
      // Store challenge
      challenges.set(validatedData.username, options.challenge);
      
      res.json(options);
    } catch (error) {
      console.error("Registration options error:", error);
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  // WebAuthn Registration - Verify Response
  app.post("/api/auth/register/verify", async (req, res) => {
    try {
      const { username, role, credential } = req.body;
      
      const expectedChallenge = challenges.get(username);
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
        // Create user
        const user = await db.user.create({
          data: { username, role }
        });
        
        // Store credential
        await db.credential.create({
          data: {
            id: verification.registrationInfo.credential.id,
            userId: user.id,
            publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
            counter: verification.registrationInfo.credential.counter,
          }
        });
        
        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
        
        // Clean up challenge
        challenges.delete(username);
        
        res.json({ verified: true, token, user: { id: user.id, username: user.username, role: user.role } });
      } else {
        res.status(400).json({ error: "Registration verification failed" });
      }
    } catch (error) {
      console.error("Registration verification error:", error);
      res.status(400).json({ error: "Registration verification failed" });
    }
  });

  // WebAuthn Login - Generate Options
  app.post("/api/auth/login/options", async (req, res) => {
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
      
      // Store challenge
      challenges.set(username, options.challenge);
      
      res.json(options);
    } catch (error) {
      console.error("Login options error:", error);
      res.status(400).json({ error: "Failed to generate login options" });
    }
  });

  // WebAuthn Login - Verify Response
  app.post("/api/auth/login/verify", async (req, res) => {
    try {
      const { username, credential } = req.body;
      
      const expectedChallenge = challenges.get(username);
      if (!expectedChallenge) {
        return res.status(400).json({ error: "No challenge found for user" });
      }
      
      const user = await db.user.findUnique({
        where: { username }
      });
      
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const dbCredential = await db.credential.findUnique({
        where: { id: credential.id }
      });
      
      if (!dbCredential || dbCredential.userId !== user.id) {
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
        
        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
        
        // Clean up challenge
        challenges.delete(username);
        
        res.json({ verified: true, token, user: { id: user.id, username: user.username, role: user.role } });
      } else {
        res.status(400).json({ error: "Authentication verification failed" });
      }
    } catch (error) {
      console.error("Login verification error:", error);
      res.status(400).json({ error: "Authentication verification failed" });
    }
  });

  // Create Promise
  app.post("/api/promises", authenticateJWT, async (req: any, res) => {
    try {
      const promiseData = insertPromiseSchema.parse(req.body);
      
      // Generate key pair for this promise
      const keyPair = PromiseCrypto.generateKeyPair();
      
      // Create fingerprint data from WebAuthn credential
      const fingerprintData = `${req.user.id}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
      const hashedFingerprint = PromiseCrypto.hashFingerprint(fingerprintData);
      
      // Encrypt promise with content + private key + fingerprint
      const encryptedData = PromiseCrypto.encryptPromise(
        promiseData.content,
        keyPair.privateKey,
        fingerprintData
      );
      
      const promise = await db.promise.create({
        data: {
          title: promiseData.title,
          content: promiseData.content,
          metadata: promiseData.metadata,
          encryptedData,
          fingerprint: hashedFingerprint,
          deliveryDate: promiseData.deliveryDate,
          recipientId: promiseData.recipientId,
          creatorId: req.user.id,
        },
        include: {
          creator: true,
        }
      });
      
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
      
      // Generate signing challenge for WebAuthn
      const signingChallenge = WebAuthnPromiseService.generateSigningChallenge({
        id: promise.id,
        title: promise.title,
        content: promise.content,
        deliveryDate: promise.deliveryDate.toISOString(),
        creatorId: promise.creatorId
      });

      res.json({ 
        promise, 
        certificate,
        signingChallenge,
        requiresWebAuthnSigning: true
      });
    } catch (error) {
      console.error("Promise creation error:", error);
      res.status(400).json({ error: "Failed to create promise" });
    }
  });

  // Share Promise
  app.post("/api/promises/:id/share", authenticateJWT, async (req: any, res) => {
    try {
      const { userIds } = promiseShareSchema.parse(req.body);
      const promiseId = req.params.id;
      
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
      const shares = await globalThis.Promise.all(
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
        deliveryDate: promise.deliveryDate.toISOString(),
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
        return res.status(400).json({ error: "No signed promise provided" });
      }

      const verificationResult = await WebAuthnPromiseService.verifySignedPromise(signedPromise);

      res.json({
        verification: verificationResult,
        promise: {
          id: signedPromise.id,
          title: signedPromise.title,
          creator: signedPromise.creator.username,
          deliveryDate: signedPromise.deliveryDate,
          createdAt: signedPromise.createdAt,
        }
      });
    } catch (error) {
      console.error("Promise verification error:", error);
      res.status(400).json({ error: "Failed to verify promise" });
    }
  });

  // Get Promises
  app.get("/api/promises", authenticateJWT, async (req: any, res) => {
    try {
      let promises;
      
      if (req.user.role === "admin") {
        // Admin can see all promises
        promises = await db.promise.findMany({
          include: {
            creator: true,
            shares: {
              include: {
                user: true,
              }
            },
            certificates: true,
          },
          orderBy: {
            createdAt: 'desc',
          }
        });
      } else {
        // Regular users can see their own promises and shared promises
        promises = await db.promise.findMany({
          where: {
            OR: [
              { creatorId: req.user.id },
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
            creator: true,
            shares: {
              include: {
                user: true,
              }
            },
            certificates: true,
          },
          orderBy: {
            createdAt: 'desc',
          }
        });
      }
      
      res.json({ promises });
    } catch (error) {
      console.error("Get promises error:", error);
      res.status(500).json({ error: "Failed to get promises" });
    }
  });

  // Validate Promise Certificate
  app.post("/api/promises/:id/validate", authenticateJWT, async (req: any, res) => {
    try {
      const promiseId = req.params.id;
      
      const promise = await db.promise.findUnique({
        where: { id: promiseId },
        include: {
          certificates: true,
          creator: true,
        }
      });
      
      if (!promise) {
        return res.status(404).json({ error: "Promise not found" });
      }
      
      const certificate = promise.certificates[0];
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      const isValid = PromiseCrypto.validateCertificate(
        certificate.certificate,
        certificate.publicKey
      );
      
      let decryptedData = null;
      if (req.user.id === promise.creatorId && isValid) {
        try {
          decryptedData = PromiseCrypto.decryptPromise(promise.encryptedData);
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
        decryptedData: req.user.id === promise.creatorId ? decryptedData : null,
      });
    } catch (error) {
      console.error("Certificate validation error:", error);
      res.status(500).json({ error: "Failed to validate certificate" });
    }
  });

  // Get Current User
  app.get("/api/auth/me", authenticateJWT, async (req: any, res) => {
    res.json({ user: req.user });
  });

  // Admin Stats
  app.get("/api/admin/stats", authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const [totalUsers, totalPromises, totalShares] = await globalThis.Promise.all([
        db.user.count(),
        db.promise.count(),
        db.promiseShare.count(),
      ]);
      
      res.json({
        totalUsers,
        totalPromises,
        totalShares,
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Get All Users (for sharing)
  app.get("/api/users", authenticateJWT, async (req: any, res) => {
    try {
      const users = await db.user.findMany({
        where: {
          id: {
            not: req.user.id, // Exclude current user
          }
        },
        select: {
          id: true,
          username: true,
          role: true,
        },
        orderBy: {
          username: 'asc',
        }
      });
      
      res.json({ users });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}