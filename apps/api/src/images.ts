import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImagesService {
  signature() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret)
      throw new ServiceUnavailableException(
        'Image uploads are not configured. Add the Cloudinary credentials to the API environment and restart the API.',
      );
    const params = {
      timestamp: Math.floor(Date.now() / 1000),
      folder: process.env.CLOUDINARY_FOLDER || 'stockroom/products',
    };
    return {
      cloudName,
      apiKey,
      ...params,
      signature: cloudinary.utils.api_sign_request(params, apiSecret),
    };
  }
  async upload(files: Express.Multer.File[]) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Image uploads are not configured. Add the Cloudinary credentials to the API environment and restart the API.',
      );
    }
    if (!files?.length || files.length > 7)
      throw new BadRequestException('Choose between 1 and 7 images');
    for (const file of files) {
      if (!file.size || file.size > MAX_IMAGE_BYTES)
        throw new BadRequestException('Each image must be between 1 byte and 10 MB');
      if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/octet-stream') {
        throw new BadRequestException('Only image files are allowed');
      }
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    const results = await Promise.allSettled(
      files.map(
        (file) =>
          new Promise<UploadApiResponse>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: 'image',
                folder: process.env.CLOUDINARY_FOLDER || 'stockroom/products',
                timeout: 60000,
              },
              (error, result) => {
                if (error || !result) reject(error || new Error('No upload response'));
                else resolve(result);
              },
            );
            stream.on('error', reject);
            stream.end(file.buffer);
          }),
      ),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      await Promise.allSettled(
        results.flatMap((result) =>
          result.status === 'fulfilled'
            ? [cloudinary.uploader.destroy(result.value.public_id, { resource_type: 'image' })]
            : [],
        ),
      );
      if (failed.reason?.http_code === 400)
        throw new BadRequestException(
          'An image could not be processed. Check that it is a valid image supported by Cloudinary.',
        );
      throw new BadGatewayException(
        'Cloudinary could not upload the images. Check the upload configuration and try again.',
      );
    }
    return {
      urls: results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value.secure_url] : [],
      ),
    };
  }
}
