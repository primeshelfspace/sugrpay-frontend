import { apiServiceFor } from '@platform/platform-contracts';

/**
 * The backend is three APIs, each with its own address: the platform
 * (sign-in, company, brands, team…), Sugrpay (invoices, customers, payments…)
 * and, later, HQ. Which one serves a path is decided by apiServiceFor — the
 * same rule the backend's nginx front door uses — so this app never keeps its
 * own list.
 *
 * Each falls back to NEXT_PUBLIC_API_URL, the single front door
 * (api.sugrpay.com) that passes every path to the right API.
 */
const FRONT_DOOR = process.env['NEXT_PUBLIC_API_URL'];

export const PLATFORM_API_URL =
  process.env['NEXT_PUBLIC_PLATFORM_API_URL'] ?? FRONT_DOOR ?? 'http://localhost:4001';
export const SUGRPAY_API_URL =
  process.env['NEXT_PUBLIC_SUGRPAY_API_URL'] ?? FRONT_DOOR ?? 'http://localhost:4002';

/** The base address of the API that serves `path`. */
export function apiUrlFor(path: string): string {
  return apiServiceFor(path) === 'sugrpay' ? SUGRPAY_API_URL : PLATFORM_API_URL;
}
