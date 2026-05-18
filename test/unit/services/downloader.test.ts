import { describe, expect, it, mock } from 'bun:test';
import { mockAppConfig } from '../../helpers/mockConfig';

mock.module('@/config', () => ({ appConfig: mockAppConfig }));

import { DownloaderService } from '@/services/downloader';

function makeAsyncIterable(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
    return {
        [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk;
        },
    };
}

describe('DownloaderService', () => {
    describe('download — URL scheme validation', () => {
        it('throws for unsupported scheme', async () => {
            const service = new DownloaderService();
            await expect(service.download('ftp://example.com/file')).rejects.toThrow('Unsupported URL scheme');
        });
    });

    describe('streamToTemp — size limit', () => {
        it('throws when stream exceeds maxFileSizeMb', async () => {
            const service = new DownloaderService();
            const maxBytes = mockAppConfig.download.maxFileSizeMb * 1024 * 1024;
            const oversized = new Uint8Array(maxBytes + 1);
            // @ts-expect-error — testing protected method directly
            await expect(service.streamToTemp(makeAsyncIterable([oversized]))).rejects.toThrow(
                `${mockAppConfig.download.maxFileSizeMb} MB limit`
            );
        });

        it('succeeds within size limit', async () => {
            const service = new DownloaderService();
            const data = new Uint8Array([1, 2, 3]);
            // @ts-expect-error — testing protected method directly
            const result = await service.streamToTemp(makeAsyncIterable([data]));
            expect(result.sizeBytes).toBe(3);
            expect(result.fileHash).toBeTypeOf('string');
            expect(result.fileHash.length).toBe(32);
        });
    });

    describe('streamToTemp — hashing', () => {
        it('produces consistent MD5 hash for same content', async () => {
            const service = new DownloaderService();
            const data = new Uint8Array([10, 20, 30]);
            // @ts-expect-error — testing protected method directly
            const r1 = await service.streamToTemp(makeAsyncIterable([data]));
            // @ts-expect-error — testing protected method directly
            const r2 = await service.streamToTemp(makeAsyncIterable([data]));
            expect(r1.fileHash).toBe(r2.fileHash);
        });

        it('produces different hashes for different content', async () => {
            const service = new DownloaderService();
            // @ts-expect-error — testing protected method directly
            const r1 = await service.streamToTemp(makeAsyncIterable([new Uint8Array([1])]));
            // @ts-expect-error — testing protected method directly
            const r2 = await service.streamToTemp(makeAsyncIterable([new Uint8Array([2])]));
            expect(r1.fileHash).not.toBe(r2.fileHash);
        });
    });

    describe('downloadHttps', () => {
        it('throws on non-2xx response', async () => {
            const service = new DownloaderService();
            globalThis.fetch = mock(() =>
                Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }))
            ) as unknown as typeof fetch;

            // @ts-expect-error — testing protected method directly
            await expect(service.downloadHttps('https://example.com/file')).rejects.toThrow('HTTP 404');
        });

        it('throws when response has no body', async () => {
            const service = new DownloaderService();
            const mockResponse = new Response(null, { status: 200 });
            Object.defineProperty(mockResponse, 'body', { get: () => null });
            globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

            // @ts-expect-error — testing protected method directly
            await expect(service.downloadHttps('https://example.com/file')).rejects.toThrow('no body');
        });
    });

    describe('downloadS3', () => {
        it('throws for invalid S3 URL', async () => {
            const service = new DownloaderService();
            // @ts-expect-error — testing protected method directly
            await expect(service.downloadS3('s3://no-key')).rejects.toThrow('Invalid S3 URL');
        });

        it('streams from S3 file', async () => {
            const service = new DownloaderService();
            const data = new Uint8Array([1, 2, 3]);
            const mockStream = new ReadableStream<Uint8Array>({
                start(ctrl) {
                    ctrl.enqueue(data);
                    ctrl.close();
                },
            }) as unknown as ReadableStream<Uint8Array<ArrayBuffer>>;
            // @ts-expect-error — overriding protected for test
            service.buildS3Client = () =>
                ({
                    file: () => ({ stream: () => mockStream }) as unknown as Bun.S3File,
                }) as unknown as Bun.S3Client;

            // @ts-expect-error — testing protected method directly
            const result = await service.downloadS3('s3://bucket/key');
            expect(result.sizeBytes).toBe(3);
        });
    });
});
