import { allowedOrigins } from '../src/origins';

describe('deployment origins', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it('accepts configured and Vercel production, deployment and branch origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://stockroom.example, https://stockroom.example';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'stockroom.vercel.app';
    process.env.VERCEL_URL = 'stockroom-deployment.vercel.app';
    process.env.VERCEL_BRANCH_URL = 'stockroom-preview.vercel.app';
    expect(allowedOrigins()).toEqual([
      'https://stockroom.example',
      'https://stockroom.vercel.app',
      'https://stockroom-deployment.vercel.app',
      'https://stockroom-preview.vercel.app',
    ]);
    expect(allowedOrigins()).not.toContain('http://localhost:5174');
  });
  it('preserves local development ports', () => {
    process.env.NODE_ENV = 'development';
    expect(allowedOrigins()).toEqual(
      expect.arrayContaining(['http://localhost:5173', 'http://localhost:5174']),
    );
  });
});
