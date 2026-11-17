import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import type {
    ClientMessage,
    ServerMessage,
    SourceType,
} from "premiereremote-shared";
import {
    UXP_REQUEST_TIMEOUT_MS,
    HOSTS,
    HOST_LABELS,
    hostForAction,
    type HostId,
} from "premiereremote-shared/config";
import type { ManagedServer } from "./server.js";
import { log, logError, logAndExit } from "../log.js";

/** WebSocket close code for "Policy Violation" */
const CLOSE_POLICY_VIOLATION = 1008;

/** Host assumed for panels that connect without a `?host=` query (older Premiere builds of the plugin). */
const DEFAULT_HOST: HostId = "premierepro";

/** A bridge between the server and the UXP plugin. */
export interface Bridge {
    /**
     * Whether the panel that handles `actionId` is connected. Without an `actionId`, checks Premiere Pro
     * (the original, single-host behavior).
     */
    isConnected(actionId?: string): boolean;
    sendToUxp(
        actionId: string,
        params: Record<string, unknown>,
        sourceType: SourceType,
    ): Promise<ClientMessage>;
}

/** A request that is pending a response from the UXP plugin. */
type PendingRequest = {
    host: HostId;
    resolve: (msg: ClientMessage) => void;
    timer: NodeJS.Timeout;
};

export class UxpBridge implements Bridge, ManagedServer {
    private wss: WebSocketServer | null = null;
    /** One panel connection per host application, so Premiere Pro and After Effects can run side by side. */
    private readonly uxpSockets = new Map<HostId, WebSocket>();
    private readonly pending = new Map<string, PendingRequest>();

    constructor(
        readonly port: number,
        private readonly requestTimeoutMs: number = UXP_REQUEST_TIMEOUT_MS,
    ) {}

    start(): Promise<void> {
        const wss = new WebSocketServer({ port: this.port });
        this.wss = wss;

        const listening = new Promise<void>((resolve, reject) => {
            wss.once("listening", resolve);
            wss.once("error", reject);
        });

        wss.on("connection", (ws, req) => {
            const host = parseHost(req.url);
            if (!host) {
                logError("UXP", `rejected a connection with an unknown host: ${req.url}`);
                ws.close(CLOSE_POLICY_VIOLATION, "Unknown host");
                return;
            }

            const label = HOST_LABELS[host];
            if (this.uxpSockets.get(host)?.readyState === WebSocket.OPEN) {
                logError(
                    "UXP",
                    `rejected a new ${label} connection; only one is supported at a time`,
                );
                ws.close(
                    CLOSE_POLICY_VIOLATION,
                    // "Premiere" (not "Premiere Pro") is the original wording; kept for compatibility.
                    `Only one ${host === "premierepro" ? "Premiere" : label} connection is allowed`,
                );
                return;
            }

            log("UXP", `${label} plugin connected`);
            this.uxpSockets.set(host, ws);

            ws.on("message", this.handleUxpMessage);
            ws.on("close", () => this.handleUxpClose(host, ws));
            ws.on("error", (err) => logError("UXP", "socket error:", err));
        });

        wss.on("listening", () => {
            log("UXP", `Listening on ws://localhost:${this.port}`);
        });

        wss.on("error", logAndExit("UXP"));

        return listening;
    }

    close(): Promise<void> {
        this.rejectAllPending("Server is shutting down");
        return new Promise((resolve) => {
            if (this.wss) this.wss.close(() => resolve());
            else resolve();
        });
    }

    get boundPort(): number {
        if (!this.wss) {
            throw new Error(
                "boundPort accessed before UxpBridge.start() completed",
            );
        }
        return (this.wss.address() as AddressInfo).port;
    }

    /** Returns true if the UXP plugin that handles `actionId` (default: Premiere Pro) is currently connected. */
    isConnected(actionId?: string): boolean {
        const host = actionId ? hostForAction(actionId) : DEFAULT_HOST;
        return this.uxpSockets.get(host)?.readyState === WebSocket.OPEN;
    }

    /** Sends a message to the UXP plugin and returns a promise that resolves with the response. */
    sendToUxp(
        actionId: string,
        params: Record<string, unknown>,
        sourceType: SourceType,
    ): Promise<ClientMessage> {
        const host = hostForAction(actionId);
        const socket = this.uxpSockets.get(host);
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return Promise.resolve({
                id: randomUUID(),
                status: "INTERNAL_ERROR",
                message: `${HOST_LABELS[host]} is not connected`,
            });
        }

        return new Promise<ClientMessage>((resolve) => {
            const id = randomUUID();

            const timer = setTimeout(() => {
                this.pending.delete(id);
                resolve({
                    id,
                    status: "INTERNAL_ERROR",
                    message: "Request timed out",
                });
            }, this.requestTimeoutMs);

            this.pending.set(id, { host, resolve, timer });

            const msg: ServerMessage = {
                id,
                actionId,
                sourceType,
                ...(Object.keys(params).length > 0 ? { params } : {}),
            };

            socket.send(JSON.stringify(msg));
        });
    }

    /** Handles a message received from the UXP plugin. */
    private handleUxpMessage = (data: RawData): void => {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(data.toString()) as ClientMessage;
        } catch {
            logError("UXP", "failed to parse message:", data.toString());
            return;
        }

        const req = this.pending.get(msg.id);
        if (req) {
            clearTimeout(req.timer);
            this.pending.delete(msg.id);
            req.resolve(msg);
        }
    };

    /** Handles a UXP plugin disconnecting. Rejects that host's pending requests. */
    private handleUxpClose(host: HostId, ws: WebSocket): void {
        log("UXP", `${HOST_LABELS[host]} plugin disconnected`);
        // Only forget the socket if it is still the registered one for this host.
        if (this.uxpSockets.get(host) === ws) this.uxpSockets.delete(host);
        this.rejectAllPending("UXP connection closed", host);
    }

    /** Rejects pending requests with the given reason (all of them, or only those of one host). */
    private rejectAllPending(reason: string, host?: HostId): void {
        for (const [id, req] of this.pending) {
            if (host && req.host !== host) continue;
            clearTimeout(req.timer);
            this.pending.delete(id);
            req.resolve({ id, status: "INTERNAL_ERROR", message: reason });
        }
    }
}

/** Reads the host from a connection URL such as `/?host=aftereffects`. No query means the default host. */
function parseHost(url: string | undefined): HostId | null {
    const requested = new URL(url ?? "/", "ws://localhost").searchParams.get("host");
    if (requested === null) return DEFAULT_HOST;
    return (HOSTS as readonly string[]).includes(requested) ? (requested as HostId) : null;
}
