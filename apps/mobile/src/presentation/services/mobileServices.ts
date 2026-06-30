import { BookingService } from "../../application/services/BookingService";
import { CustodyService } from "../../application/services/CustodyService";
import { NotificationService } from "../../application/services/NotificationService";
import { NotificationPreferenceService } from "../../application/services/NotificationPreferenceService";
import { NotificationRouter } from "../../application/services/NotificationRouter";
import { OfflineService } from "../../application/services/OfflineService";
import { PushNotificationService } from "../../application/services/PushNotificationService";
import { PushRegistrationService } from "../../application/services/PushRegistrationService";
import { ReviewService } from "../../application/services/ReviewService";
import { ShipmentService } from "../../application/services/ShipmentService";
import { TripService } from "../../application/services/TripService";
import { TrustService } from "../../application/services/TrustService";
import { EventBus } from "../../domain/events/EventBus";
import {
  FirebaseBookingRepository,
  FirebaseCustodyRepository,
  FirebaseNotificationRepository,
  FirebaseNotificationPreferenceRepository,
  FirebaseReviewRepository,
  FirebaseShipmentRepository,
  FirebaseTripRepository,
  FirebaseTrustRepository,
} from "../../infrastructure/firebase/repositories";
import { firebaseOfflineStatusGateway } from "../../infrastructure/firebase/FirebaseOfflineStatusGateway";
import {
  FirebaseNotificationRoutingSource,
  FirebasePushNotificationGateway,
  FirebasePushTokenRepository,
} from "../../infrastructure/firebase/push";
import { ExpoPushTokenRegistrationGateway } from "../../infrastructure/expo/notifications";
import { reportApplicationError } from "../errors/getFriendlyError";

const eventBus = new EventBus();
const bookingRepository = new FirebaseBookingRepository();
const custodyRepository = new FirebaseCustodyRepository();
const notificationRepository = new FirebaseNotificationRepository();
const notificationPreferenceRepository =
  new FirebaseNotificationPreferenceRepository();
const reviewRepository = new FirebaseReviewRepository();
const shipmentRepository = new FirebaseShipmentRepository();
const tripRepository = new FirebaseTripRepository();
const trustRepository = new FirebaseTrustRepository();
const pushNotificationService = new PushNotificationService(
  new FirebasePushNotificationGateway(),
);
const pushRegistrationService = new PushRegistrationService(
  new ExpoPushTokenRegistrationGateway(),
  new FirebasePushTokenRepository(),
);
const notificationRouter = new NotificationRouter(
  new FirebaseNotificationRoutingSource(),
);

firebaseOfflineStatusGateway.setBackgroundErrorReporter((error, operation) => {
  reportApplicationError(error, operation);
});

const notificationService = new NotificationService(
  eventBus,
  notificationRepository,
  (error) => reportApplicationError(error, "notifications.persist-event"),
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
  notificationPreferences: new NotificationPreferenceService(
    notificationPreferenceRepository,
  ),
  notificationRouter,
  offline: new OfflineService(firebaseOfflineStatusGateway),
  pushNotification: pushNotificationService,
  pushRegistration: pushRegistrationService,
  review: new ReviewService(reviewRepository, bookingRepository, eventBus),
  shipment: new ShipmentService(shipmentRepository, eventBus),
  trip: new TripService(tripRepository, eventBus),
  trust: new TrustService(trustRepository, reviewRepository),
} as const;
