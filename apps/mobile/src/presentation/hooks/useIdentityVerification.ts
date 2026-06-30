import { useCallback, useEffect, useRef, useState } from "react";
import type { IdentityVerificationStatusSummary } from "../../application/services/IdentityVerificationService";
import type { IdentityVerification } from "../../domain/identity/IdentityVerification";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";

export interface IdentityVerificationState {
  readonly error: string | null;
  readonly loading: boolean;
  readonly summary: IdentityVerificationStatusSummary | null;
  readonly verification: IdentityVerification | null;
  refresh(): Promise<void>;
}

export function useIdentityVerification(
  userId: string | null,
): IdentityVerificationState {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [summary, setSummary] =
    useState<IdentityVerificationStatusSummary | null>(null);
  const [verification, setVerification] =
    useState<IdentityVerification | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!userId) {
      setError(null);
      setLoading(false);
      setSummary(null);
      setVerification(null);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const [nextVerification, nextSummary] = await Promise.all([
        mobileServices.identityVerification.getCurrentVerification(userId),
        mobileServices.identityVerification.getStatusSummary(userId),
      ]);
      if (requestId.current !== currentRequestId) {
        return;
      }
      setVerification(nextVerification);
      setSummary(nextSummary);
    } catch (loadError) {
      if (requestId.current !== currentRequestId) {
        return;
      }
      setVerification(null);
      setSummary(null);
      setError(
        reportFriendlyError(loadError, "identity-verification.load-current"),
      );
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  return { error, loading, refresh, summary, verification };
}
