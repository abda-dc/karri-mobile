import { createMatchFilter, type MatchFilter } from "../../domain/matching/MatchFilter";
import {
  MatchDataFreshness,
  type MatchEvidence,
  type MatchResult,
} from "../../domain/matching/MatchResult";
import { MatchFactor } from "../../domain/matching/MatchReason";
import { scoreMatch } from "../../domain/matching/scoringFactors";
import type { Shipment } from "../../domain/shipment/Shipment";
import type { Trip } from "../../domain/trip/Trip";
import { systemClock, type Clock } from "./Clock";
import { ConnectionStatus, type OfflineStatus } from "./OfflineService";
import type { IdentityVerificationService } from "./IdentityVerificationService";
import type { OfflineService } from "./OfflineService";
import type { ShipmentService } from "./ShipmentService";
import type { TripService } from "./TripService";
import type { TrustService } from "./TrustService";

export class MatchingService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly trips: TripService,
    private readonly trust: TrustService,
    private readonly identity: IdentityVerificationService,
    private readonly offline: OfflineService,
    private readonly clock: Clock = systemClock,
  ) {}

  async findMatches(
    input: Partial<MatchFilter> = {},
  ): Promise<ReadonlyArray<MatchResult>> {
    const filter = createMatchFilter(input);
    const status = this.offline.getStatus();
    const [shipments, trips] = await Promise.all([
      this.shipments.listActive(),
      this.trips.listActive(),
    ]);
    const selectedShipments = this.selectShipments(shipments, filter);
    const selectedTrips = this.selectTrips(trips, filter);
    const evidence = await this.loadEvidence(selectedTrips, filter.viewerId);
    const evaluatedAt = this.clock.now();
    const dataFreshness = this.getDataFreshness(status);
    const matches = selectedShipments.flatMap((shipment) =>
      selectedTrips.map((trip) =>
        this.createResult(
          shipment,
          trip,
          evidence.get(trip.ownerId) ?? emptyEvidence,
          filter,
          dataFreshness,
          evaluatedAt,
        ),
      ),
    );

    return matches
      .filter((match) => !filter.eligibleOnly || match.eligible)
      .filter((match) => match.score.total >= filter.minimumScore)
      .sort(compareMatches)
      .slice(0, filter.maximumResults);
  }

  evaluate(
    shipment: Shipment,
    trip: Trip,
    evidence: MatchEvidence = emptyEvidence,
    input: Partial<MatchFilter> = {},
  ): MatchResult {
    return this.createResult(
      shipment,
      trip,
      evidence,
      createMatchFilter(input),
      this.getDataFreshness(this.offline.getStatus()),
      this.clock.now(),
    );
  }

  private createResult(
    shipment: Shipment,
    trip: Trip,
    evidence: MatchEvidence,
    filter: MatchFilter,
    dataFreshness: MatchResult["dataFreshness"],
    evaluatedAt: string,
  ): MatchResult {
    const evaluation = scoreMatch(shipment, trip, evidence, filter);
    return {
      dataFreshness,
      eligible: evaluation.eligible,
      evaluatedAt,
      id: `${shipment.id}:${trip.id}`,
      reasons: evaluation.reasons,
      score: evaluation.score,
      shipment,
      trip,
    };
  }

  private async loadEvidence(
    trips: ReadonlyArray<Trip>,
    viewerId: string,
  ): Promise<ReadonlyMap<string, MatchEvidence>> {
    const travelerIds = [...new Set(trips.map(({ ownerId }) => ownerId))];
    const entries = await Promise.all(
      travelerIds.map(async (travelerId): Promise<readonly [string, MatchEvidence]> => {
        const [trustResult, identityResult] = await Promise.allSettled([
          this.trust.getVisibleSummary(travelerId),
          viewerId
            ? this.identity.getVisibleStatusSummary(travelerId, viewerId)
            : Promise.resolve(null),
        ]);
        const trustSummary = trustResult.status === "fulfilled" ? trustResult.value : null;
        const identitySummary = identityResult.status === "fulfilled" ? identityResult.value : null;

        return [
          travelerId,
          {
            completedDeliveries: trustSummary?.inputs.completedDeliveries ?? null,
            identityStatus: identitySummary?.status ?? null,
            trustScore: trustSummary?.score.score ?? null,
          },
        ];
      }),
    );
    return new Map(entries);
  }

  private selectShipments(
    shipments: ReadonlyArray<Shipment>,
    filter: MatchFilter,
  ): ReadonlyArray<Shipment> {
    if (filter.shipmentIds.length === 0) return shipments;
    const selected = new Set(filter.shipmentIds);
    return shipments.filter(({ id }) => selected.has(id));
  }

  private selectTrips(
    trips: ReadonlyArray<Trip>,
    filter: MatchFilter,
  ): ReadonlyArray<Trip> {
    if (filter.tripIds.length === 0) return trips;
    const selected = new Set(filter.tripIds);
    return trips.filter(({ id }) => selected.has(id));
  }

  private getDataFreshness(status: OfflineStatus): MatchResult["dataFreshness"] {
    switch (status.connection) {
      case ConnectionStatus.Online:
        return MatchDataFreshness.Live;
      case ConnectionStatus.Offline:
        return MatchDataFreshness.Cached;
      case ConnectionStatus.Unknown:
        return MatchDataFreshness.Unknown;
    }
  }
}

const emptyEvidence: MatchEvidence = {
  completedDeliveries: null,
  identityStatus: null,
  trustScore: null,
};

function compareMatches(left: MatchResult, right: MatchResult): number {
  const scoreDifference = right.score.total - left.score.total;
  if (scoreDifference !== 0) return scoreDifference;

  const leftRoute = left.score.factors.find(({ factor }) => factor === MatchFactor.RouteSimilarity);
  const rightRoute = right.score.factors.find(({ factor }) => factor === MatchFactor.RouteSimilarity);
  const routeDifference = (rightRoute?.earnedPoints ?? 0) - (leftRoute?.earnedPoints ?? 0);
  if (routeDifference !== 0) return routeDifference;

  const dateDifference = left.trip.departureDate.localeCompare(right.trip.departureDate);
  return dateDifference !== 0 ? dateDifference : left.id.localeCompare(right.id);
}
