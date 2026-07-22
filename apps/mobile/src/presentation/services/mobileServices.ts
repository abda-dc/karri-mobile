import { AuthSessionService } from "../../application/services/AuthSessionService";
import { BookingService } from "../../application/services/BookingService";
import { CustodyService } from "../../application/services/CustodyService";
import { IdentityVerificationService } from "../../application/services/IdentityVerificationService";
import { MatchingService } from "../../application/services/MatchingService";
import { LocalNotificationService } from "../../application/services/LocalNotificationService";
import { NotificationService } from "../../application/services/NotificationService";
import { NotificationPreferenceService } from "../../application/services/NotificationPreferenceService";
import { NotificationRouter } from "../../application/services/NotificationRouter";
import { OfflineService } from "../../application/services/OfflineService";
import { ProfileService } from "../../application/services/ProfileService";
import { PushNotificationService } from "../../application/services/PushNotificationService";
import { PushRegistrationService } from "../../application/services/PushRegistrationService";
import { ReviewService } from "../../application/services/ReviewService";
import { ShipmentService } from "../../application/services/ShipmentService";
import { ShipmentTimelineService } from "../../application/services/ShipmentTimelineService";
import { TripService } from "../../application/services/TripService";
import { TrustService } from "../../application/services/TrustService";
import { EventBus } from "../../domain/events/EventBus";
import { FirebaseAuthSessionGateway } from "../../infrastructure/firebase/auth";
import {
  FirebaseBookingRepository,
  FirebaseCustodyRepository,
  FirebaseNotificationRepository,
  FirebaseNotificationPreferenceRepository,
  FirebaseProfileRepository,
  FirebaseReviewRepository,
  FirebaseShipmentRepository,
  FirebaseTripRepository,
  FirebaseTrustRepository,
  FirebaseVerificationRepository,
} from "../../infrastructure/firebase/repositories";
import { firebaseOfflineStatusGateway } from "../../infrastructure/firebase/FirebaseOfflineStatusGateway";
import {
  FirebaseNotificationRoutingSource,
  FirebasePushNotificationGateway,
  FirebasePushTokenRepository,
} from "../../infrastructure/firebase/push";
import {
  ExpoLocalNotificationResponseGateway,
  ExpoPushTokenRegistrationGateway,
} from "../../infrastructure/expo/notifications";
import { reportApplicationError } from "../errors/getFriendlyError";
import { PrivilegedCallableTransport } from "../../infrastructure/firebase/privilegedCallableTransport";
import { PlatformAppCheckTokenProvider } from "../../infrastructure/firebase/appCheckTokenProvider";

const eventBus = new EventBus();
const bookingRepository = new FirebaseBookingRepository();
const custodyRepository = new FirebaseCustodyRepository();
const notificationRepository = new FirebaseNotificationRepository();
const notificationPreferenceRepository =
  new FirebaseNotificationPreferenceRepository();
const profileRepository = new FirebaseProfileRepository();
const reviewRepository = new FirebaseReviewRepository();
const shipmentRepository = new FirebaseShipmentRepository();
const tripRepository = new FirebaseTripRepository();
const trustRepository = new FirebaseTrustRepository();
const verificationRepository = new FirebaseVerificationRepository();
const identityVerificationService = new IdentityVerificationService(
  verificationRepository,
);
const offlineService = new OfflineService(firebaseOfflineStatusGateway);
const shipmentService = new ShipmentService(shipmentRepository, eventBus);
const tripService = new TripService(tripRepository, eventBus);
const trustService = new TrustService(trustRepository, reviewRepository);
const matchingService = new MatchingService(
  shipmentService,
  tripService,
  trustService,
  identityVerificationService,
  offlineService,
);
const localNotificationService = new LocalNotificationService(
  new ExpoLocalNotificationResponseGateway(),
);
const pushNotificationService = new PushNotificationService(
  new FirebasePushNotificationGateway(),
);
const allowBypass =
  typeof __DEV__ !== "undefined" &&
  __DEV__ === true &&
  process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS === "true";

const privilegedCallableTransport = new PrivilegedCallableTransport({
  appCheckTokenProvider: new PlatformAppCheckTokenProvider(),
  allowDevelopmentBypass: allowBypass,
});

const pushRegistrationService = new PushRegistrationService(
  new ExpoPushTokenRegistrationGateway(),
  new FirebasePushTokenRepository(privilegedCallableTransport),
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
  auth: new AuthSessionService(
    new FirebaseAuthSessionGateway(),
    pushRegistrationService,
  ),
  booking: new BookingService(
    bookingRepository,
    shipmentRepository,
    tripRepository,
    eventBus,
  ),
  custody: new CustodyService(custodyRepository, bookingRepository),
  identityVerification: identityVerificationService,
  matching: matchingService,
  localNotifications: localNotificationService,
  notification: notificationService,
  notificationPreferences: new NotificationPreferenceService(
    notificationPreferenceRepository,
  ),
  notificationRouter,
  offline: offlineService,
  profile: new ProfileService(profileRepository),
  pushNotification: pushNotificationService,
  pushRegistration: pushRegistrationService,
  review: new ReviewService(reviewRepository, bookingRepository, eventBus),
  shipment: shipmentService,
  shipmentTimeline: new ShipmentTimelineService(custodyRepository),
  trip: tripService,
  trust: trustService,
  privilegedCallable: privilegedCallableTransport,
} as const;
