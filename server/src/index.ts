import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { MCPServer } from "./server.js";
import cors from "cors";

const PORT = 3000;

const server = new MCPServer(new Server({
    name: "remote-mcp-server",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {},
        logging: {}
    }
}));

// to support multiple simultaneous connections
const app = express();
const router = express.Router();

app.use(express.json());
app.use(cors());

// endpoint for the client to use for sending messages
const MCP_ENDPOINT = "/mcp";
router.post(MCP_ENDPOINT, async (req: any, res: any) => {
    await server.handlePostRequest(req, res);
});

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
router.get(MCP_ENDPOINT, async (req: any, res: any) => {
    await server.handleGetRequest(req, res);
});


app.use('/', router);

app.listen(PORT, () => {
    console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await server.cleanup();
    process.exit(0);
});
