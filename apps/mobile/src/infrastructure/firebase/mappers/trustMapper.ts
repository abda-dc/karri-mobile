import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type {
  TrustFactorResult,
  TrustScore,
} from "../../../domain/trust/TrustScore";
import { numberValue, snapshotData, stringValue } from "./firestoreValues";

export function mapTrustScore(snapshot: DocumentSnapshot<DocumentData>): TrustScore {
  const data = snapshotData(snapshot);
  const factors: ReadonlyArray<TrustFactorResult> = Array.isArray(data.factors)
    ? data.factors.map((factor: DocumentData) => ({
        key: factor.key as TrustFactorResult["key"],
        points: numberValue(factor.points),
        explanation: stringValue(factor.explanation),
      }))
    : [];

  return {
    userId: stringValue(data.userId, snapshot.id),
    score: numberValue(data.score),
    formulaVersion: 1,
    factors,
    calculatedAt: stringValue(data.calculatedAt),
  };
}

export function toFirestoreTrustScore(score: TrustScore): DocumentData {
  return {
    userId: score.userId,
    score: score.score,
    formulaVersion: score.formulaVersion,
    factors: score.factors,
    calculatedAt: score.calculatedAt,
  };
}
