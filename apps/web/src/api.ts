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
export function uploadProductImages(files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append('images', file));
  return api<{ urls: string[] }>('/products/images/upload', 'POST', body, 120000);
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
