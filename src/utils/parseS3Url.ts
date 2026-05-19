export type S3UrlParts = {
    bucket: string;
    key: string;
};

export function parseS3Url(url: string): S3UrlParts | null {
    const m = /^s3:\/\/([^/]+)\/(.+)$/.exec(url);
    if (!m) return null;
    return { bucket: m[1] as string, key: m[2] as string };
}
