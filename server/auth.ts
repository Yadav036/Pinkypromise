import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { insertUserSchema } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Password-based registration
export async function registerUser(username: string, password: string) {
  // Validate input
  const validatedData = insertUserSchema.parse({ username, password });
  
  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { username: validatedData.username }
  });
  
  if (existingUser) {
    throw new Error("Username already exists");
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(validatedData.password, 12);
  
  // Create user
  const user = await db.user.create({
    data: { 
      username: validatedData.username, 
      password: hashedPassword 
    }
  });
  
  // Generate JWT token
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
  
  return { 
    token, 
    user: { 
      id: user.id, 
      username: user.username 
    } 
  };
}

// Password-based login
export async function loginUser(username: string, password: string) {
  const user = await db.user.findUnique({
    where: { username }
  });
  
  if (!user) {
    throw new Error("User not found");
  }
  
  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    throw new Error("Invalid password");
  }
  
  // Generate JWT token
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
  
  return { 
    token, 
    user: { 
      id: user.id, 
      username: user.username 
    } 
  };
}

// JWT middleware
export function authenticateJWT(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = { id: decoded.userId };
      next();
    } catch (error) {
      res.status(403).json({ error: "Invalid token" });
    }
  } else {
    res.status(401).json({ error: "No token provided" });
  }
}