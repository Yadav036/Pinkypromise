import { z } from "zod";

// User types
export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertCredentialSchema = z.object({
  id: z.string(),
  userId: z.string(),
  publicKey: z.string(),
  counter: z.number().default(0),
});

// Promise types
export const insertPromiseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Promise content is required"),
  metadata: z.record(z.any()).optional().default({}),
  deliveryDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  recipientId: z.string().min(1, "Recipient is required"),
});

export const promiseShareSchema = z.object({
  promiseId: z.string(),
  userIds: z.array(z.string()),
});

// Inferred types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type InsertPromise = z.infer<typeof insertPromiseSchema>;
export type PromiseShare = z.infer<typeof promiseShareSchema>;

// Database model types (will be provided by Prisma client)
export interface User {
  id: string;
  username: string;
  password: string;
  createdAt: Date;
}

export interface Credential {
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
  createdAt: Date;
}

export interface Promise {
  id: string;
  title: string;
  content: string;
  metadata: any;
  encryptedData: string;
  fingerprint: string;
  credentialId: string;
  deliveryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  creator?: User;
}

export interface PromiseCertificate {
  id: string;
  promiseId: string;
  certificate: string;
  publicKey: string;
  createdAt: Date;
}
