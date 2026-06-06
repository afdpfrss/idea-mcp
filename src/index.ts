import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { registerIdeaTools } from "./tools/ideas.js";

export interface Env {
  DB: D1Database;
}

/**
 * Cloudflare Workers の fetch ハンドラ上で MCP の Streamable HTTP を実現する
 * ステートレスなトランスポート。1 回の HTTP POST = 1 回の JSON-RPC やり取り。
 *
 * Workers には Node の http サーバーが無いため、SDK 同梱の
 * StreamableHTTPServerTransport は使わず、Transport インターフェースを
 * 直接実装して McpServer に接続する。
 */
class WorkersHttpTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private onResponse: ((message: JSONRPCMessage) => void) | null = null;

  async start(): Promise<void> {
    // McpServer.connect() から呼ばれる。接続単位の初期化は不要。
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.onResponse?.(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  /**
   * 受信した JSON-RPC メッセージ（単体または配列）を server に流し込み、
   * 対応するレスポンスを集めて返す。通知のみの場合は空配列。
   */
  async dispatch(
    payload: JSONRPCMessage | JSONRPCMessage[]
  ): Promise<JSONRPCMessage[]> {
    const messages = Array.isArray(payload) ? payload : [payload];

    const expectedIds = new Set(
      messages
        .filter((m) => isRequest(m))
        .map((m) => (m as { id: string | number }).id)
    );

    if (expectedIds.size === 0) {
      // 通知 / レスポンスのみ。サーバーからの返信は無い。
      for (const m of messages) this.onmessage?.(m);
      return [];
    }

    const collected: JSONRPCMessage[] = [];
    return new Promise<JSONRPCMessage[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("MCP request timed out"));
      }, 30_000);

      this.onResponse = (message) => {
        collected.push(message);
        const id = (message as { id?: string | number }).id;
        if (id !== undefined) expectedIds.delete(id);
        if (expectedIds.size === 0) {
          clearTimeout(timer);
          this.onResponse = null;
          resolve(collected);
        }
      };

      for (const m of messages) this.onmessage?.(m);
    });
  }
}

function isRequest(message: JSONRPCMessage): boolean {
  return (
    typeof (message as { method?: unknown }).method === "string" &&
    (message as { id?: unknown }).id !== undefined
  );
}

function buildServer(env: Env): { server: McpServer; transport: WorkersHttpTransport } {
  const server = new McpServer({
    name: "idea-mcp",
    version: "0.1.0",
  });
  registerIdeaTools(server, env.DB);
  const transport = new WorkersHttpTransport();
  return { server, transport };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function handleMcpPost(request: Request, env: Env): Promise<Response> {
  let payload: JSONRPCMessage | JSONRPCMessage[];
  try {
    payload = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const { server, transport } = buildServer(env);
  await server.connect(transport);

  try {
    const responses = await transport.dispatch(payload);
    if (responses.length === 0) {
      // 通知のみ。本文無しで受理を返す。
      return new Response(null, { status: 202 });
    }
    const body = Array.isArray(payload) ? responses : responses[0];
    return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return jsonRpcError(
      null,
      -32603,
      err instanceof Error ? err.message : "Internal error"
    );
  } finally {
    await server.close();
  }
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    { status: 200, headers: JSON_HEADERS }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      if (request.method === "POST") {
        return handleMcpPost(request, env);
      }
      // ステートレス運用のため GET(SSE) / DELETE(セッション終了) は非対応。
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({ name: "idea-mcp", status: "ok", endpoint: "/mcp" }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
