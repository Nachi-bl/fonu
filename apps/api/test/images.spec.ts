import 'reflect-metadata';
import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PassThrough } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { ImagesService, MAX_IMAGE_BYTES } from '../src/images';
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: { upload_stream: jest.fn(), destroy: jest.fn().mockResolvedValue({ result: 'ok' }) },
  },
}));
describe('Cloudinary product images', () => {
  const service = new ImagesService();
  const original = { ...process.env };
  const upload = cloudinary.uploader.upload_stream as jest.Mock;
  const file = (mimetype = 'image/png') =>
    ({ buffer: Buffer.from('image'), size: 5, mimetype }) as Express.Multer.File;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    let index = 0;
    upload.mockImplementation((_options, callback) => {
      const id = String(index++);
      const stream = new PassThrough();
      stream.on('finish', () =>
        callback(null, {
          secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${id}.png`,
          public_id: id,
        }),
      );
      return stream;
    });
  });
  afterAll(() => {
    process.env = original;
  });
  it('returns ordered HTTPS URLs for seven images without restricting image formats', async () => {
    const formats = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/heic',
      'application/octet-stream',
    ];
    const result = await service.upload(formats.map((type) => file(type)));
    expect(result.urls).toHaveLength(7);
    expect(result.urls[0]).toContain('/0.png');
    expect(upload).toHaveBeenCalledTimes(7);
    expect(upload.mock.calls[0][0]).toMatchObject({ resource_type: 'image' });
  });
  it('fails clearly when credentials have not been configured', async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    await expect(service.upload([file()])).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(upload).not.toHaveBeenCalled();
  });
  it('rejects empty batches, excess images, oversized files, and non-images before uploading', async () => {
    for (const files of [
      [],
      Array.from({ length: 8 }, () => file()),
      [{ ...file(), size: MAX_IMAGE_BYTES + 1 }],
      [file('video/mp4')],
    ]) {
      await expect(service.upload(files)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(upload).not.toHaveBeenCalled();
  });
  it('cleans up a partially failed batch and reports invalid image content', async () => {
    upload.mockImplementationOnce((_options, callback) => {
      const stream = new PassThrough();
      stream.on('finish', () => callback({ http_code: 400 }));
      return stream;
    });
    await expect(service.upload([file(), file()])).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
  });
  it('does not expose provider credentials or error payloads', async () => {
    upload.mockImplementation((_options, callback) => {
      const stream = new PassThrough();
      stream.on('finish', () => callback({ http_code: 401, message: 'secret-provider-details' }));
      return stream;
    });
    await expect(service.upload([file()])).rejects.toBeInstanceOf(BadGatewayException);
    await expect(service.upload([file()])).rejects.not.toThrow('secret-provider-details');
  });
});
