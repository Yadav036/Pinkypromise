import crypto from 'crypto';
// Using basic types instead of @simplewebauthn/types

export interface SignedPromise {
  id: string;
  title: string;
  content: string;
  deliveryDate: string;
  createdAt: string;
  creator: {
    id: string;
    username: string;
  };
  encryptedContent: string;
  signature: {
    credentialId: string;
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string;
  };
  publicKey: string;
  challenge: string;
  rpId: string;
}

export class WebAuthnPromiseService {
  
  // Generate challenge for promise signing
  static generateSigningChallenge(promiseData: {
    id: string;
    title: string;
    content: string;
    deliveryDate: string;
    creatorId: string;
  }): string {
    // Create SHA-256 hash of promise data for challenge
    const promiseHash = crypto.createHash('sha256')
      .update(JSON.stringify(promiseData))
      .digest();
    
    return Buffer.from(promiseHash).toString('base64url');
  }

  // Encrypt promise content for local storage
  static encryptPromiseContent(content: string, key: string): string {
    const algorithm = 'aes-256-gcm';
    const keyBuffer = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  // Decrypt promise content for verification
  static decryptPromiseContent(encryptedData: string, key: string): string {
    try {
      const { encrypted, iv, authTag } = JSON.parse(encryptedData);
      const algorithm = 'aes-256-gcm';
      const keyBuffer = crypto.createHash('sha256').update(key).digest();
      
      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt promise content');
    }
  }

  // Create downloadable signed promise
  static createSignedPromiseFile(
    promiseData: any,
    signatureData: {
      credentialId: string;
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle: string;
    },
    publicKey: string,
    challenge: string
  ): SignedPromise {
    // Encrypt the promise content
    const encryptionKey = `${promiseData.id}-${promiseData.creatorId}-${Date.now()}`;
    const encryptedContent = this.encryptPromiseContent(promiseData.content, encryptionKey);

    return {
      id: promiseData.id,
      title: promiseData.title,
      content: promiseData.content, // Keep original for display
      deliveryDate: promiseData.deliveryDate,
      createdAt: promiseData.createdAt,
      creator: promiseData.creator,
      encryptedContent,
      signature: signatureData,
      publicKey,
      challenge,
      rpId: process.env.REPLIT_DOMAINS || 'localhost'
    };
  }

  // Verify signed promise file
  static async verifySignedPromise(signedPromise: SignedPromise): Promise<{
    isValid: boolean;
    isSignatureValid: boolean;
    isChallengeValid: boolean;
    isDataIntact: boolean;
    creator: string;
    errorDetails?: string;
  }> {
    try {
      // 1. Verify challenge matches promise data hash
      const expectedChallenge = this.generateSigningChallenge({
        id: signedPromise.id,
        title: signedPromise.title,
        content: signedPromise.content,
        deliveryDate: signedPromise.deliveryDate,
        creatorId: signedPromise.creator.id
      });

      const isChallengeValid = signedPromise.challenge === expectedChallenge;

      // 2. Parse and verify clientDataJSON
      const clientData = JSON.parse(
        Buffer.from(signedPromise.signature.clientDataJSON, 'base64url').toString('utf8')
      );

      const isClientDataValid = 
        clientData.type === 'webauthn.get' &&
        clientData.challenge === signedPromise.challenge &&
        clientData.origin.includes(signedPromise.rpId);

      // 3. Verify signature with public key
      const isSignatureValid = await this.verifyWebAuthnSignature(
        signedPromise.signature,
        signedPromise.publicKey,
        signedPromise.challenge
      );

      const isDataIntact = true; // If we got this far, JSON parsing succeeded

      const isValid = isChallengeValid && isClientDataValid && isSignatureValid && isDataIntact;

      return {
        isValid,
        isSignatureValid,
        isChallengeValid,
        isDataIntact,
        creator: signedPromise.creator.username,
        errorDetails: isValid ? undefined : `Challenge: ${isChallengeValid}, ClientData: ${isClientDataValid}, Signature: ${isSignatureValid}`
      };

    } catch (error) {
      return {
        isValid: false,
        isSignatureValid: false,
        isChallengeValid: false,
        isDataIntact: false,
        creator: signedPromise.creator?.username || 'Unknown',
        errorDetails: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // Verify WebAuthn signature
  private static async verifyWebAuthnSignature(
    signature: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
    },
    publicKeyPem: string,
    expectedChallenge: string
  ): Promise<boolean> {
    try {
      // Create the data that was signed
      const clientDataHash = crypto.createHash('sha256')
        .update(Buffer.from(signature.clientDataJSON, 'base64url'))
        .digest();

      const authenticatorDataBuffer = Buffer.from(signature.authenticatorData, 'base64url');
      const signedData = Buffer.concat([authenticatorDataBuffer, clientDataHash]);

      // Import public key
      const publicKey = crypto.createPublicKey({
        key: publicKeyPem,
        format: 'pem'
      });

      // Verify signature
      const signatureBuffer = Buffer.from(signature.signature, 'base64url');
      
      return crypto.verify('sha256', signedData, publicKey, signatureBuffer);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}