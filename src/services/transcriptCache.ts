import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { transcriptions } from '@/db/schema';
import { createBunS3Client } from '@/services/s3';
import { parseS3Url } from '@/utils/parseS3Url';

function stripEtagQuotes(etag: string): string {
    return etag.replace(/^"|"$/g, '');
}

export class TranscriptCacheService {
    async getEtag(url: string): Promise<string | null> {
        if (url.startsWith('s3://')) return this.getS3Etag(url);
        return this.getHttpsEtag(url);
    }

    async lookupByHash(fileHash: string): Promise<string | null> {
        const rows = await db
            .select({ id: transcriptions.id })
            .from(transcriptions)
            .where(eq(transcriptions.file_hash, fileHash))
            .limit(1);
        return rows[0]?.id ?? null;
    }

    protected async getS3Etag(url: string): Promise<string | null> {
        const parsed = parseS3Url(url);
        if (!parsed) return null;
        try {
            const file = this.buildS3Client().file(parsed.key, { bucket: parsed.bucket });
            const stat = await file.stat();
            return stat.etag ? stripEtagQuotes(stat.etag) : null;
        } catch {
            return null;
        }
    }

    protected async getHttpsEtag(url: string): Promise<string | null> {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            const etag = res.headers.get('etag') ?? res.headers.get('content-md5');
            return etag ? stripEtagQuotes(etag) : null;
        } catch {
            return null;
        }
    }

    protected buildS3Client(): Bun.S3Client {
        return createBunS3Client();
    }
}

let instance: TranscriptCacheService | undefined;

export function getTranscriptCacheService(): TranscriptCacheService {
    if (!instance) instance = new TranscriptCacheService();
    return instance;
}
