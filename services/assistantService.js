const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT ||
  "https://johny03shams.services.ai.azure.com/api/projects/proj-default";
const agentName = process.env.FOUNDRY_AGENT_NAME ||
  "computerandlaptopsalesandserviceagent";

let openAIClient;

function getOpenAIClient() {
  if (!openAIClient) {
    const projectClient = new AIProjectClient(
      projectEndpoint,
      new DefaultAzureCredential()
    );
    openAIClient = projectClient.getOpenAIClient();
  }
  return openAIClient;
}

async function reply(conversationId, message) {
  const client = getOpenAIClient();
  let activeConversationId = conversationId;

  if (activeConversationId) {
    await client.conversations.items.create(activeConversationId, {
      items: [{ type: "message", role: "user", content: message }]
    });
  } else {
    const conversation = await client.conversations.create({
      items: [{ type: "message", role: "user", content: message }]
    });
    activeConversationId = conversation.id;
  }

  const response = await client.responses.create(
    { conversation: activeConversationId },
    { body: { agent: { name: agentName, type: "agent_reference" } } }
  );

  if (typeof response.output_text !== "string" || !response.output_text.trim()) {
    throw new Error("The AI assistant returned no text.");
  }

  return {
    conversationId: activeConversationId,
    reply: response.output_text.trim()
  };
}

function isAuthenticationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /authentication failed|failed to get token|credential unavailable|authenticationerror/i
    .test(message);
}

module.exports = { reply, isAuthenticationError };
