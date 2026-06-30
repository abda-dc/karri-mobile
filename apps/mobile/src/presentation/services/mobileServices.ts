import { BookingService } from "../../application/services/BookingService";
import { CustodyService } from "../../application/services/CustodyService";
import { NotificationService } from "../../application/services/NotificationService";
import { OfflineService } from "../../application/services/OfflineService";
import { ReviewService } from "../../application/services/ReviewService";
import { ShipmentService } from "../../application/services/ShipmentService";
import { TripService } from "../../application/services/TripService";
import { TrustService } from "../../application/services/TrustService";
import { EventBus } from "../../domain/events/EventBus";
import {
  FirebaseBookingRepository,
  FirebaseCustodyRepository,
  FirebaseNotificationRepository,
  FirebaseReviewRepository,
  FirebaseShipmentRepository,
  FirebaseTripRepository,
  FirebaseTrustRepository,
} from "../../infrastructure/firebase/repositories";
import { firebaseOfflineStatusGateway } from "../../infrastructure/firebase/FirebaseOfflineStatusGateway";

const eventBus = new EventBus();
const bookingRepository = new FirebaseBookingRepository();
const custodyRepository = new FirebaseCustodyRepository();
const notificationRepository = new FirebaseNotificationRepository();
const reviewRepository = new FirebaseReviewRepository();
const shipmentRepository = new FirebaseShipmentRepository();
const tripRepository = new FirebaseTripRepository();
const trustRepository = new FirebaseTrustRepository();

const notificationService = new NotificationService(
  eventBus,
  notificationRepository,
  (error) => console.warn("In-app notification could not be persisted.", error),
);
notificationService.start();

export const mobileServices = {
  booking: new BookingService(
    bookingRepository,
    shipmentRepository,
    tripRepository,
    eventBus,
  ),
  custody: new CustodyService(custodyRepository, bookingRepository),
  notification: notificationService,
  offline: new OfflineService(firebaseOfflineStatusGateway),
  review: new ReviewService(reviewRepository, bookingRepository, eventBus),
  shipment: new ShipmentService(shipmentRepository, eventBus),
  trip: new TripService(tripRepository, eventBus),
  trust: new TrustService(trustRepository, reviewRepository),
} as const;
