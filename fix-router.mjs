import fs from 'fs';

const p = 'apps/cli/src/router.ts';
let code = fs.readFileSync(p, 'utf8');

// 1. Add "address" commands
const addressCommands = `
    const addressCmd = args[0];
    if (addressCmd === "address") {
      const subCmd = args[1];
      if (!subCmd || subCmd === "list") {
        return ok(renderAddressList(deps.store.listAddresses()));
      }
      if (subCmd === "add") {
        const name = args[2];
        const address = args[3];
        if (!name || !address) {
          return err("Usage: chainmind address add <name> <address> [--chain <chainKey>]");
        }
        const chainFlagIdx = args.indexOf("--chain");
        const chainKey = chainFlagIdx >= 0 ? args[chainFlagIdx + 1] : undefined;
        deps.store.saveAddress({
          name,
          address,
          chainKey,
          createdAt: new Date().toISOString()
        });
        return ok(\`Address '\${name}' added successfully.\`);
      }
      if (subCmd === "get") {
        const naimport fs from 'fs';

const pme
const p = 'apps/cl: clet code = fs.readFileSync(p, 'utf  
// 1. Add "address" commands
const as(ncoe);
        if (!entry) ret    const addressCmd = aun    if (addressCmd === "addres o      const subCmd = args[1];
            if (!subCmd || subCmd ve        return ok(renderAddress2];
             }
      if (subCmd === "add") {
        const name = args[;
                const = deps.store.rem        const address = args (        if (!name || !address) no          return err("Usage: chet        }
        const chainFlagIdx = args.indexOf("--chain");
        const chainKey = cd:        md        const chainKey = chainFlagIdx >= 0 ? args[ch==        deps.store.saveAddress({
          name,
          address,
          c a          name,
          addre0]          addr)           chainKene          createdAg         });
        return ok(\`Address '\${
/        repl      }
      if (subCmd === "get") {
        co

// Balance: t       p        const naimport fs fr.s
const pme
const p = 'apps/cl: clet?? conscode =// 1. Add "address" commandarsed.address ?? "",',
  'targeconst as(ncoe);
        if or        if (!ess            if (!subCmd || subCmd ve        return ok(renderAddress2];
             }
      if (subCmd === "aod             }
      if (subCmd === "add") {
        const name = arg?       if (subso        const name = args[;

)                const = de(o        const chainFlagIdx = args.indexOf("--chain");
        const chainKey = cd:        md        const chainKey = chainFlagIdx >= 0 ? args[ye        const chainKey = cd:      ode);

