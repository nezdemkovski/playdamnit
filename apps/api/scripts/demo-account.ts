// The shared read-only demo account the apps sign into from "Try the demo" (POST /api/demo/session).
// Run from apps/api with DEMO_USERNAME and DEMO_PASSWORD in the environment (.env):
//
//   bun run scripts/demo-account.ts create   # make the account (or reset its password and flags)
//   bun run scripts/demo-account.ts unlock   # make it a regular member, to fill its library by hand
//   bun run scripts/demo-account.ts lock     # back to read only and hidden; the demo works again
//
// DEMO_EMAIL and DEMO_NAME set the address and display name of a new account.
import { closeDb } from "@/db/postgres";
import { DemoService } from "@/modules/demo/service";

enum Command {
  Create = "create",
  Lock = "lock",
  Unlock = "unlock",
}

const command = process.argv[2] as Command | undefined;

const main = async () => {
  switch (command) {
    case Command.Create: {
      const { id, created } = await DemoService.ensureAccount({
        email: process.env.DEMO_EMAIL ?? "demo@playdamnit.com",
        name: process.env.DEMO_NAME ?? "Demo",
      });
      console.log(`${created ? "created" : "updated"} the demo account (${id})`);
      return;
    }
    case Command.Lock:
      await DemoService.setLocked(true);
      console.log("locked: read only and hidden again");
      return;
    case Command.Unlock:
      await DemoService.setLocked(false);
      console.log('unlocked: a regular member until "lock" (its list stays private)');
      return;
    default:
      console.error(`usage: bun run scripts/demo-account.ts <${Object.values(Command).join("|")}>`);
      process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
