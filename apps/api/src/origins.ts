export function allowedOrigins() {
  const configured =
    process.env.CORS_ORIGIN?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) || [];
  const hosted = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
  const origins = [...configured, ...hosted];
  if (process.env.NODE_ENV !== 'production')
    origins.push('http://localhost:5173', 'http://localhost:5174');
  return [...new Set(origins)];
}
