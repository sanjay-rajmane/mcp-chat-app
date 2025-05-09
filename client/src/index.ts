import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { URL } from "url";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LoggingMessageNotificationSchema, ToolListChangedNotificationSchema, TextContentSchema } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express from 'express';

export const sseClients = new Set<express.Response>();

const app = express();
app.use(express.json());
const router = express.Router();
app.use(cors());
app.use('/', router);

class MCPClient {
    tools: { name: string; description: string }[] = [];
    client;
    transport: StreamableHTTPClientTransport | null = null;
    isCompleted = false;
    notifications = [];

    constructor(serverName: string) {
        this.client = new Client({ name: `mcp-client-for-${serverName}`, version: "1.0.0" });
    }

    async connectToServer(serverUrl: string | { toString: () => string; }) {
        const url = new URL(serverUrl);
        try {
            this.transport = new StreamableHTTPClientTransport(url);
            await this.client.connect(this.transport);
            console.log("Connected to server");
            this.setUpTransport();
            this.setUpNotifications();
        }
        catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    async listTools() {
        try {
            const toolsResult = await this.client.listTools();
            console.log('Available tools:', toolsResult.tools);
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description ?? "",
                };
            });
        }
        catch (error) {
            console.log(`Tools not supported by the server (${error})`);
        }
    }

    async callTool(name: string, args = { name: "myName" }) {
        try {
        this.notifications = []; // clear old messages

        const result = await this.client.callTool({
            name,
            arguments: args,
        });

        let messages: string[] = [...this.notifications];

        (result.content as unknown[]).forEach((item) => {
            const parse = TextContentSchema.safeParse(item);
            if (parse.success) {
            messages.push(parse.data.text);
            }
        });

        return messages;
        } catch (error) {
            console.error(`Error calling tool ${name}:`, error);
            return ["Something went wrong."];
        }
    }
  
    setUpNotifications() {
        this.client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
        console.log("LoggingMessageNotificationSchema received:", notification);
        const message = notification.params?.data || 'log';
        console.log('MCP NOTIFY:', message);

        // Stream to all SSE clients (React apps)
        for (const client of sseClients) {
            client.write(`data: ${message}\n\n`);
        }
        });

        this.client.setNotificationHandler(ToolListChangedNotificationSchema, async (notification) => {
        console.log("ToolListChangedNotificationSchema received:", notification);
        await this.listTools();
        });
    }

    setUpTransport() {
        if (this.transport === null) {
            return;
        }
        this.transport.onclose = () => {
            console.log("SSE transport closed.");
            this.isCompleted = true;
        };
        this.transport.onerror = async (error) => {
            console.log("SSE transport error: ", error);
            await this.cleanup();
        };
    }

    async waitForCompletion() {
        while (!this.isCompleted) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async cleanup() {
        await this.client.close();
    }
}

// async function main() {
//     const client = new MCPClient("sse-server");
//     try {
//         await client.connectToServer("http://localhost:3000/mcp");
//         await client.listTools();
//         for (const tool of client.tools) {
//             await client.callTool(tool.name);
//         }
//         await client.waitForCompletion();
//     }
//     finally {
//         await client.cleanup();
//     }
// }
// main();

const mcpClient = new MCPClient("sse-server");

router.post('/send-message', async (req, res) => {
    const { message } = req.body;
  
    try {
        await mcpClient.connectToServer("http://localhost:3000/mcp");
     
        const reply = await mcpClient.callTool('multi-great', { name: message });
        res.json({ reply });
    } catch (e) {
        console.error("MCP error", e);
        res.status(500).json({ error: "Failed to get response from MCP" });
    }
});

router.get('/stream', async (req, res) => {
    res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.listen(3001, () => {
    console.log(`MCP Streamable HTTP Server listening on port 3001`);
});

export default router;
