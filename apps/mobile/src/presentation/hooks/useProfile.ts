import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "../../domain/profile/Profile";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";

export interface ProfileState {
  readonly error: string | null;
  readonly loading: boolean;
  readonly profile: Profile | null;
  refresh(): Promise<void>;
}

export function useProfile(userId: string | null): ProfileState {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [profile, setProfile] = useState<Profile | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!userId) {
      setError(null);
      setLoading(false);
      setProfile(null);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const nextProfile = await mobileServices.profile.findByUserId(userId);
      if (requestId.current !== currentRequestId) {
        return;
      }
      setProfile(nextProfile);
    } catch (loadError) {
      if (requestId.current !== currentRequestId) {
        return;
      }
      setProfile(null);
      setError(reportFriendlyError(loadError, "profile.load-current"));
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

  return { error, loading, profile, refresh };
}
