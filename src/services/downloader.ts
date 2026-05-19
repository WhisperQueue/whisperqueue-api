import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appConfig } from '@/config';
import { createBunS3Client } from '@/services/s3';
import { parseS3Url } from '@/utils/parseS3Url';

export type DownloadResult = {
    tempPath: string;
    fileHash: string;
    sizeBytes: number;
};

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.|0\.|::1$|\[::1\]$)/;

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

export class DownloaderService {
    async download(url: string): Promise<DownloadResult> {
        if (url.startsWith('s3://')) return this.downloadS3(url);
        if (url.startsWith('http://') || url.startsWith('https://')) return this.downloadHttps(url);
        throw new Error(`Unsupported URL scheme: ${url}`);
    }

    protected validateUrl(url: string): void {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (BLOCKED_HOSTS.has(host) || PRIVATE_IP_RE.test(host)) {
            throw new Error(`Blocked URL — private or reserved address: ${url}`);
        }
    }

    protected async downloadS3(url: string): Promise<DownloadResult> {
        const parsed = parseS3Url(url);
        if (!parsed) throw new Error(`Invalid S3 URL: ${url}`);

        const file = this.buildS3Client().file(parsed.key, { bucket: parsed.bucket });
        const stream = file.stream() as ReadableStream<Uint8Array>;
        return this.streamToTemp(this.webStreamToAsyncIterable(stream));
    }

    protected async downloadHttps(url: string): Promise<DownloadResult> {
        this.validateUrl(url);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), appConfig.download.timeoutSeconds * 1000);

        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            if (!res.body) throw new Error('Response has no body');
            return this.streamToTemp(this.webStreamToAsyncIterable(res.body));
        } finally {
            clearTimeout(timer);
        }
    }

    protected async streamToTemp(source: AsyncIterable<Uint8Array>): Promise<DownloadResult> {
        const tempPath = this.makeTempPath();
        const maxBytes = appConfig.download.maxFileSizeMb * 1024 * 1024;
        const hash = createHash('md5');
        let sizeBytes = 0;

        const writer = Bun.file(tempPath).writer();

        try {
            for await (const chunk of source) {
                sizeBytes += chunk.length;
                if (sizeBytes > maxBytes) {
                    throw new Error(`File exceeds ${appConfig.download.maxFileSizeMb} MB limit`);
                }
                hash.update(chunk);
                writer.write(chunk);
            }
            await writer.end();
        } catch (err) {
            await Promise.resolve(writer.end()).catch(() => {});
            await unlink(tempPath).catch(() => {});
            throw err;
        }

        return { tempPath, fileHash: hash.digest('hex'), sizeBytes };
    }

    protected makeTempPath(): string {
        return join(tmpdir(), `wq-${crypto.randomUUID()}`);
    }

    protected buildS3Client(): Bun.S3Client {
        return createBunS3Client();
    }

    protected async *webStreamToAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                yield value;
            }
        } finally {
            reader.releaseLock();
        }
    }
}

let instance: DownloaderService | undefined;

export function getDownloaderService(): DownloaderService {
    if (!instance) instance = new DownloaderService();
    return instance;
}
