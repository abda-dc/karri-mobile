import { createFirebaseAdminGateway } from "./gateways/createFirebaseAdminGateway.js";
import type { FirebaseAdminConsoleGateway } from "./gateways/FirebaseAdminGateway.js";
import {
  AdminConsoleClaimsService,
  type AdminTarget,
} from "./services/AdminConsoleClaimsService.js";

interface CliOptions {
  command?: string;
  uid?: string;
  email?: string;
  role?: string;
  projectId?: string;
  confirmProduction: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: args[0],
    confirmProduction: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--confirm-production") {
      options.confirmProduction = true;
    } else if (argument === "--uid" && value) {
      options.uid = value;
      index += 1;
    } else if (argument === "--email" && value) {
      options.email = value;
      index += 1;
    } else if (argument === "--role" && value) {
      options.role = value;
      index += 1;
    } else if (argument === "--project-id" && value) {
      options.projectId = value;
      index += 1;
    }
  }

  return options;
}

function getTarget(options: CliOptions): AdminTarget {
  if (Boolean(options.uid) === Boolean(options.email)) {
    throw new Error("Provide exactly one target: '--uid <uid>' or '--email <email>'.");
  }
  return options.uid ? { uid: options.uid } : { email: options.email! };
}

function writeStatus(
  verb: string,
  status: {
    readonly target: string;
    readonly role: string | null;
    readonly approved: boolean;
    readonly unrelatedClaimCount: number;
  },
  changed?: boolean,
): void {
  const outcome = changed === undefined ? "" : changed ? " changed=true;" : " changed=false;";
  console.log(
    `${verb}: ${status.target};${outcome} role=${status.role ?? "none"}; approved=${status.approved}; unrelatedClaims=${status.unrelatedClaimCount}.`,
  );
}

export async function main(
  args: string[],
  testGateway?: FirebaseAdminConsoleGateway,
): Promise<number> {
  const options = parseArgs(args);

  try {
    if (!["verify", "grant", "remove"].includes(options.command ?? "")) {
      throw new Error("Command must be one of: verify, grant, remove.");
    }
    if (!options.projectId?.trim()) {
      throw new Error("'--project-id <production-project-id>' is required.");
    }

    const target = getTarget(options);
    const gateway = testGateway ?? createFirebaseAdminGateway(options.projectId.trim());
    const service = new AdminConsoleClaimsService(gateway);

    if (options.command === "verify") {
      writeStatus("Verified", await service.verify(target));
      return 0;
    }

    if (options.command === "grant") {
      if (!options.role) {
        throw new Error("'--role <approved-admin-role>' is required for grant.");
      }
      const result = await service.grant(
        target,
        options.role,
        options.confirmProduction,
      );
      writeStatus("Grant complete", result.status, result.changed);
      return 0;
    }

    const result = await service.remove(target, options.confirmProduction);
    writeStatus("Removal complete", result.status, result.changed);
    return 0;
  } catch (error: unknown) {
    const safeMessages = [
      "Command must be one of:",
      "'--project-id",
      "Provide exactly one target:",
      "'--role",
      "Production mutation refused.",
      "A valid Firebase UID",
      "A valid Firebase user email",
      "Role must be one of:",
      "The target must be an existing non-anonymous",
    ];
    const message = error instanceof Error ? error.message : "";
    const safeMessage = safeMessages.some((prefix) => message.startsWith(prefix))
      ? message
      : "The target could not be resolved or updated. Verify the project, credentials, and selector.";
    console.error(`Operation failed: ${safeMessage}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("adminConsoleClaimsCli.ts") ||
    process.argv[1].endsWith("adminConsoleClaimsCli.js"))
) {
  void main(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
