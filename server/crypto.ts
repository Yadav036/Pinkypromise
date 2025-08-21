import crypto from "crypto";
import forge from "node-forge";

export class PromiseCrypto {
  // Generate RSA key pair for promise encryption
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const keyPair = forge.pki.rsa.generateKeyPair(2048);
    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);
    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
    
    return {
      publicKey: publicKeyPem,
      privateKey: privateKeyPem
    };
  }

  // Encrypt promise data with content + private key + fingerprint
  static encryptPromise(
    content: string,
    privateKey: string,
    fingerprintData: string
  ): string {
    const combinedData = JSON.stringify({
      content,
      privateKey,
      fingerprint: fingerprintData,
      timestamp: Date.now()
    });

    // Use AES-256-GCM for symmetric encryption
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('promiseshare-auth'));
    
    let encrypted = cipher.update(combinedData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine key, iv, authTag, and encrypted data
    const encryptedPackage = {
      key: key.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    };

    return Buffer.from(JSON.stringify(encryptedPackage)).toString('base64');
  }

  // Decrypt promise data
  static decryptPromise(encryptedData: string): {
    content: string;
    privateKey: string;
    fingerprint: string;
    timestamp: number;
  } {
    try {
      const encryptedPackage = JSON.parse(
        Buffer.from(encryptedData, 'base64').toString('utf8')
      );

      const key = Buffer.from(encryptedPackage.key, 'hex');
      const iv = Buffer.from(encryptedPackage.iv, 'hex');
      const authTag = Buffer.from(encryptedPackage.authTag, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from('promiseshare-auth'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedPackage.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt promise data');
    }
  }

  // Generate certificate for promise validation
  static generateCertificate(
    promiseId: string,
    publicKey: string,
    creatorFingerprint: string
  ): string {
    const certificateData = {
      promiseId,
      publicKey,
      creatorFingerprint,
      issuedAt: Date.now(),
      issuer: 'PromiseShare Authority'
    };

    // Use HMAC for certificate signing instead of RSA (simpler and more reliable)
    const hmacKey = crypto.createHash('sha256').update('promiseshare-cert-authority').digest();
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(JSON.stringify(certificateData));
    const signature = hmac.digest('hex');
    
    return Buffer.from(JSON.stringify({
      data: certificateData,
      signature
    })).toString('base64');
  }

  // Validate certificate
  static validateCertificate(certificate: string, publicKey: string): boolean {
    try {
      const cert = JSON.parse(
        Buffer.from(certificate, 'base64').toString('utf8')
      );

      // Validate HMAC signature
      const hmacKey = crypto.createHash('sha256').update('promiseshare-cert-authority').digest();
      const hmac = crypto.createHmac('sha256', hmacKey);
      hmac.update(JSON.stringify(cert.data));
      const expectedSignature = hmac.digest('hex');
      
      return cert.signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }

  // Hash fingerprint data for storage
  static hashFingerprint(fingerprintData: string): string {
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }
}