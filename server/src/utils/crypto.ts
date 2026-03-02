import crypto from 'crypto';
import LZString from 'lz-string';

/**
 * Generate Signature for BPJS API (VClaim/Antrean/Acare/dll)
 * Format: HMAC-SHA256(ConsID + "&" + Timestamp, SecretKey) in Base64
 */
export const generateBpjsSignature = (consId: string, secretKey: string) => {
    // Unix timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const data = `${consId}&${timestamp}`;

    const signature = crypto
        .createHmac('sha256', secretKey)
        .update(data)
        .digest('base64');

    return { signature, timestamp };
};

/**
 * Decrypt BPJS API Response String
 * BPJS Encryption flow: AES-256-CBC -> LZ-String Decompress
 */
export const decryptBpjsResponse = (
    encryptedBase64: string,
    consId: string,
    secretKey: string,
    timestamp: string
) => {
    try {
        // BPJS Key = consId + secretKey + timestamp
        const keyPlain = consId + secretKey + timestamp;
        // Hash key using SHA256 to exactly 32 bytes
        const keyBytes = crypto.createHash('sha256').update(keyPlain).digest();

        // BPJS IV = first 16 bytes of the SHA256 key
        const ivBytes = keyBytes.slice(0, 16);

        // AES-256-CBC Decryption
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, ivBytes);
        let decryptedBytes = decipher.update(encryptedBase64, 'base64', 'utf8');
        decryptedBytes += decipher.final('utf8');

        // Decompress with LZ-String
        const decompressed = LZString.decompressFromEncodedURIComponent(decryptedBytes);

        return decompressed ? JSON.parse(decompressed) : null;
    } catch (error) {
        console.error('Failed to decrypt BPJS response:', error);
        return null;
    }
};
