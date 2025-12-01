/**
 * Check if registration endpoint is enabled
 * Returns true only if VITE_ENABLE_REGISTER_ENDPOINT is 'true' or '1'
 * Returns false for any other value or undefined
 */
export function isRegisterEnabled(): boolean {
  const value = import.meta.env.VITE_ENABLE_REGISTER_ENDPOINT;
  return value === 'true' || value === '1';
}

