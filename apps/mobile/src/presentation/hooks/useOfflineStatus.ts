import { useEffect, useState } from "react";
import {
  initialOfflineStatus,
  type OfflineStatus,
} from "../../application/services/OfflineService";
import { mobileServices } from "../services/mobileServices";

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>(initialOfflineStatus);

  useEffect(() => mobileServices.offline.watchStatus(setStatus), []);

  return status;
}
