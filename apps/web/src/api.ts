export type User = { id: string; name: string; email: string; role: 'ADMIN' | 'CUSTOMER' };
export type Product = {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  priceMinor: number;
  stockQuantity: number;
  imageUrls?: string[];
  isActive: boolean;
  updatedAt: string;
};
export type Order = {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  totalMinor: number;
  paymentStatus: 'UNPAID' | 'PROCESSING' | 'PAID';
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
  user: { name: string; email: string };
  items: {
    id: string;
    productId: string;
    productNameSnapshot: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }[];
};
export type Page<T> = { data: T[]; total: number; page: number; limit: number };
let token = '';
export function setToken(value: string) {
  token = value;
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const multipart = body instanceof FormData;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        Array.isArray(data.message) ? data.message.join('. ') : data.message || 'Request failed',
      );
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new Error('The request timed out. Please try again.', { cause: error });
    if (error instanceof TypeError)
      throw new Error('Unable to reach the server. Check your connection and try again.', {
        cause: error,
      });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function uploadProductImages(
  files: File[],
  onUploaded?: (index: number, url: string) => void,
) {
  if (!files.length || files.length > 7) throw new Error('Choose between 1 and 7 images.');
  if (files.some((file) => !file.size || file.size > 10 * 1024 * 1024))
    throw new Error('Each image must be non-empty and no larger than 10 MB.');
  const signed = await api<{
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  }>('/products/images/signature', 'POST');
  const results = await Promise.allSettled(
    files.map(async (file, index) => {
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', signed.apiKey);
      body.append('timestamp', String(signed.timestamp));
      body.append('folder', signed.folder);
      body.append('signature', signed.signature);
      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,
          { method: 'POST', body, signal: AbortSignal.timeout(120000) },
        );
        const result = (await response.json()) as { secure_url?: string; resource_type?: string };
        if (
          !response.ok ||
          result.resource_type !== 'image' ||
          !result.secure_url?.startsWith('https://res.cloudinary.com/')
        )
          throw new Error(
            `${file.name} could not be uploaded. Check that it is a supported image and try again.`,
          );
        onUploaded?.(index, result.secure_url);
        return result.secure_url;
      } catch (error) {
        if (error instanceof TypeError || error instanceof DOMException)
          throw new Error(`Unable to upload ${file.name}. Check your connection and try again.`, {
            cause: error,
          });
        throw error;
      }
    }),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return {
    urls: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
  };
}
export function imagePreview(url: string) {
  return url.startsWith('https://res.cloudinary.com/')
    ? url.replace('/image/upload/', '/image/upload/f_auto,q_auto/')
    : url;
}
const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 2,
});
export const money = (minor: number) => currencyFormatter.format(minor / 100);
