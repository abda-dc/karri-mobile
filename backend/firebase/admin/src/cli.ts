import { createFirebaseAdminGateway } from "./gateways/createFirebaseAdminGateway.js";
import { RoleProvisioningService } from "./services/RoleProvisioningService.js";

function parseArgs(args: string[]) {
  const result: {
    command?: string;
    uid?: string;
    role?: string;
    confirmSuperAdminBootstrap?: boolean;
  } = {};

  result.command = args[0];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--uid" && i + 1 < args.length) {
      result.uid = args[i + 1];
      i++;
    } else if (arg === "--role" && i + 1 < args.length) {
      result.role = args[i + 1];
      i++;
    } else if (arg === "--confirm-super-admin-bootstrap") {
      result.confirmSuperAdminBootstrap = true;
    }
  }

  return result;
}

export async function main(args: string[], testGateway?: any): Promise<number> {
  const options = parseArgs(args);
  const command = options.command;

  if (!command) {
    console.error("Error: Command is required. Supported commands: get, set, remove, revoke, bootstrap");
    return 1;
  }

  if (!options.uid) {
    console.error("Error: '--uid <uid>' is required for all commands.");
    return 1;
  }

  const gateway = testGateway || createFirebaseAdminGateway();
  const service = new RoleProvisioningService(gateway);

  try {
    switch (command) {
      case "get": {
        const claims = await service.getCustomClaims(options.uid);
        console.log(JSON.stringify({ uid: options.uid, customClaims: claims }, null, 2));
        return 0;
      }
      case "set": {
        if (!options.role) {
          console.error("Error: '--role <role>' is required for command 'set'.");
          return 1;
        }
        const { claims, changed } = await service.setRole(options.uid, options.role);
        if (changed) {
          console.log(`Success: Role successfully updated for UID '${options.uid}'.`);
        } else {
          console.log(`No Change: Role is already set to '${options.role}' for UID '${options.uid}'. No tokens revoked.`);
        }
        console.log(JSON.stringify({ uid: options.uid, customClaims: claims }, null, 2));
        return 0;
      }
      case "remove": {
        const { claims, changed } = await service.removeRole(options.uid);
        if (changed) {
          console.log(`Success: Administrative role successfully removed for UID '${options.uid}'.`);
        } else {
          console.log(`No Change: User has no active administrative role for UID '${options.uid}'. No tokens revoked.`);
        }
        console.log(JSON.stringify({ uid: options.uid, customClaims: claims }, null, 2));
        return 0;
      }
      case "revoke": {
        await service.revokeTokens(options.uid);
        console.log(`Success: Refresh tokens successfully revoked for UID '${options.uid}'.`);
        return 0;
      }
      case "bootstrap": {
        const confirm = !!options.confirmSuperAdminBootstrap;
        const { claims, changed } = await service.bootstrapSuperAdmin(options.uid, confirm);
        if (changed) {
          console.log(`Success: Bootstrap first super_admin successfully completed for UID '${options.uid}'.`);
        } else {
          console.log(`No Change: User is already bootstrapped as 'super_admin' for UID '${options.uid}'.`);
        }
        console.log(JSON.stringify({ uid: options.uid, customClaims: claims }, null, 2));
        return 0;
      }
      default: {
        console.error(`Error: Unknown command '${command}'. Supported commands: get, set, remove, revoke, bootstrap`);
        return 1;
      }
    }
  } catch (error: any) {
    console.error(`Operation Failed: ${error.message || error}`);
    return 1;
  }
}

if (process.argv[1] && (process.argv[1].endsWith("cli.ts") || process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli"))) {
  main(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
