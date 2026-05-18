import { describe, expect, it } from 'bun:test';
import { parseS3Url } from '@/utils/parseS3Url';

describe('parseS3Url', () => {
    it('parses bucket and key from valid s3 URL', () => {
        expect(parseS3Url('s3://my-bucket/path/to/file.mp3')).toEqual({
            bucket: 'my-bucket',
            key: 'path/to/file.mp3',
        });
    });

    it('parses single-segment key', () => {
        expect(parseS3Url('s3://bucket/file.mp3')).toEqual({
            bucket: 'bucket',
            key: 'file.mp3',
        });
    });

    it('preserves nested path in key', () => {
        const result = parseS3Url('s3://bucket/a/b/c/d.wav');
        expect(result?.key).toBe('a/b/c/d.wav');
    });

    it('returns null for missing key', () => {
        expect(parseS3Url('s3://bucket')).toBeNull();
        expect(parseS3Url('s3://bucket/')).toBeNull();
    });

    it('returns null for non-s3 schemes', () => {
        expect(parseS3Url('https://example.com/file.mp3')).toBeNull();
        expect(parseS3Url('ftp://bucket/key')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseS3Url('')).toBeNull();
    });
});
