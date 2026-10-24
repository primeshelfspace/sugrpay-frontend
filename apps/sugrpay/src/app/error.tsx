'use client';

import { useEffect } from 'react';
import { LogoMark } from '@/components/logo-mark';

/**
 * Root error boundary. Without this, any uncaught exception from a server
 * component or action — an upstream 500, a dropped connection — falls
 * through to Next's bare default error page, which is not something a
 * client demo should ever show. This only catches what nothing else already
 * handles: pages like login, set-password and every onboarding step already
 * wrap their own API calls in try/catch and turn a failure into inline copy,
 * so this is the backstop underneath that, not a replacement for it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A page opened before a deploy still holds the old build's form actions,
    // which the new build no longer has. Reloading fetches the new page; the
    // user only has to press the button again. Once per tab session, so a
    // real failure cannot turn into a reload loop.
    if (isStaleDeployment(error) && !alreadyReloaded()) {
      window.location.reload();
      return;
    }
    // The full error still reaches the browser console for whoever is
    // debugging — this boundary only changes what the user sees.
    // eslint-disable-next-line no-console
    console.error('Unhandled error in admin app:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-[440px] text-center">
        <LogoMark size={48} />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-[#0F172A]">
          Something went wrong
        </h1>
        <p className="mt-2 text-base text-[#64748B]">
          That didn&rsquo;t go through. This is usually temporary — try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-[10px] bg-black px-4 py-3.5 text-base font-bold text-white
                     transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-black focus-visible:ring-offset-2"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}

const RELOADED_KEY = 'sugrpay:reloaded-after-deploy';

/** Records the reload, and says whether this tab already did one. Storage
 * can be unavailable (private mode); then never reload, to stay safe. */
function alreadyReloaded(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return true;
    sessionStorage.setItem(RELOADED_KEY, '1');
    return false;
  } catch {
    return true;
  }
}

/** The page belongs to an older deploy than the server (see GlobalError). */
function isStaleDeployment(error: Error): boolean {
  return (
    error.name === 'UnrecognizedActionError' ||
    /Server Action .* was not found|Failed to find Server Action/i.test(error.message) ||
    /ChunkLoadError|Loading chunk .* failed/i.test(`${error.name} ${error.message}`)
  );
}
