import * as uxp from "uxp";
import { setPanelVisible } from "../actions/custom";
import { registry } from "../generated/registry.js";
import { ui } from "./ui.js";
import { WsClient } from "./wsClient.js";

console.log("[core] PremiereRemote UXP plugin starting...");
const client = new WsClient(registry, ui);

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