import { ApplicationErrorService } from "../../application/errors/ApplicationErrorService";
import { FirebaseErrorMapper } from "../../infrastructure/firebase/FirebaseErrorMapper";
import { ConsoleApplicationErrorLogger } from "../../infrastructure/logging/ConsoleApplicationErrorLogger";

export const applicationErrorService = new ApplicationErrorService(
  [new FirebaseErrorMapper()],
  new ConsoleApplicationErrorLogger(),
);
