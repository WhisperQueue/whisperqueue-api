import { appConfig } from '@/config';

export function createBunS3Client(): Bun.S3Client {
    return new Bun.S3Client({
        region: appConfig.s3.region,
        endpoint: appConfig.s3.endpointUrl,
        accessKeyId: appConfig.s3.accessKeyId,
        secretAccessKey: appConfig.s3.secretAccessKey,
    });
}
