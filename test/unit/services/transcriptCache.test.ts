import { describe, expect, it, mock } from 'bun:test';
import { mockAppConfig } from '../../helpers/mockConfig';

mock.module('@/config', () => ({ appConfig: mockAppConfig }));

const mockSelect = mock(() => ({
    from: mock(() => ({
        where: mock(() => ({
            limit: mock(() => Promise.resolve([])),
        })),
    })),
}));

mock.module('@/db/client', () => ({ db: { select: mockSelect } }));

import { TranscriptCacheService } from '@/services/transcriptCache';

const HTTPS_URL = 'https://example.com/audio.mp3';
const S3_URL = 's3://my-bucket/audio.mp3';

describe('TranscriptCacheService', () => {
    describe('getEtag — HTTPS', () => {
        it('returns ETag header value', async () => {
            const service = new TranscriptCacheService();
            globalThis.fetch = mock(() =>
                Promise.resolve(new Response(null, { headers: { etag: '"abc123"' } }))
            ) as unknown as typeof fetch;

            const result = await service.getEtag(HTTPS_URL);
            expect(result).toBe('abc123');
        });

        it('falls back to Content-MD5 when ETag absent', async () => {
            const service = new TranscriptCacheService();
            globalThis.fetch = mock(() =>
                Promise.resolve(new Response(null, { headers: { 'content-md5': 'deadbeef' } }))
            ) as unknown as typeof fetch;

            expect(await service.getEtag(HTTPS_URL)).toBe('deadbeef');
        });

        it('returns null when no relevant headers', async () => {
            const service = new TranscriptCacheService();
            globalThis.fetch = mock(() => Promise.resolve(new Response(null))) as unknown as typeof fetch;

            expect(await service.getEtag(HTTPS_URL)).toBeNull();
        });

        it('returns null when fetch throws', async () => {
            const service = new TranscriptCacheService();
            globalThis.fetch = mock(() => Promise.reject(new Error('network'))) as unknown as typeof fetch;

            expect(await service.getEtag(HTTPS_URL)).toBeNull();
        });
    });

    describe('getEtag — S3', () => {
        it('returns ETag from stat (quotes stripped)', async () => {
            const service = new TranscriptCacheService();
            // @ts-expect-error — overriding protected for test
            service.buildS3Client = () =>
                ({
                    file: () => ({ stat: () => Promise.resolve({ etag: '"s3etag"' }) }) as unknown as Bun.S3File,
                }) as unknown as Bun.S3Client;

            expect(await service.getEtag(S3_URL)).toBe('s3etag');
        });

        it('returns null for invalid S3 URL', async () => {
            const service = new TranscriptCacheService();
            expect(await service.getEtag('s3://no-key')).toBeNull();
        });

        it('returns null when stat throws', async () => {
            const service = new TranscriptCacheService();
            // @ts-expect-error — overriding protected for test
            service.buildS3Client = () =>
                ({
                    file: () => ({ stat: () => Promise.reject(new Error('NoSuchKey')) }) as unknown as Bun.S3File,
                }) as unknown as Bun.S3Client;

            expect(await service.getEtag(S3_URL)).toBeNull();
        });
    });

    describe('lookupByHash', () => {
        it('returns transcript id when found', async () => {
            const limitMock = mock(() => Promise.resolve([{ id: 'tr_abc' }]));
            mockSelect.mockImplementation(() => ({
                from: mock(() => ({
                    where: mock(() => ({ limit: limitMock })),
                })),
            }));

            const service = new TranscriptCacheService();
            expect(await service.lookupByHash('abc123')).toBe('tr_abc');
        });

        it('returns null when not found', async () => {
            mockSelect.mockImplementation(() => ({
                from: mock(() => ({
                    where: mock(() => ({ limit: mock(() => Promise.resolve([])) })),
                })),
            }));

            const service = new TranscriptCacheService();
            expect(await service.lookupByHash('notfound')).toBeNull();
        });
    });
});
