import http from "http";
import { WebSocket, WebSocketServer } from "ws";
import type { Response } from "express";
import { BrainReport, ClientToServer, ServerToClient } from "../shared/types";

/** Browser <-> server link, plus a read-only stream for other programs (Vision) to listen to the brain. */
export class Hub {
  private wss: WebSocketServer;
  private sse = new Set<Response>();
  latest: BrainReport | null = null;
  onMessage?: (m: ClientToServer) => void;
  onConnect?: (count: number) => void;
  onDisconnect?: (count: number) => void;

  constructor(server: http.Server, private hello: () => ServerToClient) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws) => {
      ws.send(JSON.stringify(this.hello()));
      this.onConnect?.(this.clientCount);
      ws.on("message", (raw) => {
        try {
          const m = JSON.parse(raw.toString()) as ClientToServer;
          if (m.type === "report") this.latest = m.report;
          this.onMessage?.(m);
          if (m.type !== "report") this.pushSse(m);
        } catch { /* ignore malformed frames */ }
      });
      ws.on("close", () => this.onDisconnect?.(this.clientCount));
    });
  }

  get clientCount() { return [...this.wss.clients].filter((c) => c.readyState === WebSocket.OPEN).length; }

  send(msg: ServerToClient): boolean {
    const data = JSON.stringify(msg);
    let n = 0;
    for (const c of this.wss.clients) if (c.readyState === WebSocket.OPEN) { c.send(data); n++; }
    return n > 0;
  }

  addSse(res: Response) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": vision-brain stream\n\n");
    this.sse.add(res);
    res.on("close", () => this.sse.delete(res));
  }
  private pushSse(m: ClientToServer) {
    const data = `event: ${m.type}\ndata: ${JSON.stringify(m)}\n\n`;
    for (const r of this.sse) r.write(data);
  }
}
