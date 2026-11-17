import * as uxp from "uxp";
import { setPanelVisible as setPremierePanelVisible } from "../actions/custom";
import { setPanelVisible as setAePanelVisible } from "../actions/ae/custom";
import { registry } from "../generated/registry.js";
import { detectHost, registryForHost } from "./host.js";
import { ui, showHost } from "./ui.js";
import { WsClient } from "./wsClient.js";

const host = detectHost();
console.log(`[core] PremiereRemote UXP plugin starting (host: ${host})...`);
showHost(host);

// Each host only gets its own actions: `ae/*` in After Effects, everything else in Premiere Pro.
const client = new WsClient(registryForHost(registry, host), ui, host);
const setPanelVisible =
  host === "aftereffects" ? setAePanelVisible : setPremierePanelVisible;

uxp.entrypoints.setup({
  panels: {
    "de.sebinside.premiereremote.statuspanel": {
      create() {
        client.start();
      },
      show() {
        setPanelVisible(true);
        client.start();
      },
      hide() {
        setPanelVisible(false);
      },
      destroy() {
        setPanelVisible(false);
        client.stop();
      },
    },
  },
});
