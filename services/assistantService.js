const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

const azureOpenAISettingNames = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT"
];
const azureOpenAIApiVersion = process.env.OPENAI_API_VERSION || "2024-10-21";
const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT ||
  "https://johny03shams.services.ai.azure.com/api/projects/proj-default";
const agentName = process.env.FOUNDRY_AGENT_NAME ||
  "computerandlaptopsalesandserviceagent";
const assistantInstructions = [
  "You are the Master Solutions customer-support assistant for a computer sales and services business in Fujairah, UAE.",
  "Answer clearly and helpfully about computer products, sales, and services.",
  "Do not invent prices, stock availability, policies, or order details. If you do not know, say so and direct the customer to contact the shop."
].join(" ");

let openAIClient;

function getAzureOpenAIConfig() {
  const configuredSettings = azureOpenAISettingNames
    .filter((name) => process.env[name]);
  if (configuredSettings.length === 0) return null;

  const missingSettings = azureOpenAISettingNames
    .filter((name) => !process.env[name]);
  if (missingSettings.length > 0) {
    throw new Error(`Missing Azure OpenAI configuration: ${missingSettings.join(", ")}`);
  }

  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, ""),
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };
}

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

async function replyWithAzureOpenAI(conversationMessages, message, config) {
  const messages = [
    { role: "system", content: assistantInstructions },
    ...conversationMessages,
    { role: "user", content: message }
  ];
  const url = new URL(
    `/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions`,
    `${config.endpoint}/`
  );
  url.searchParams.set("api-version", azureOpenAIApiVersion);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey
    },
    body: JSON.stringify({ messages })
  });
  if (!response.ok) {
    throw new Error(`Azure OpenAI request failed (HTTP ${response.status}).`);
  }

  const result = await response.json();
  const assistantReply = result.choices?.[0]?.message?.content;
  if (typeof assistantReply !== "string" || !assistantReply.trim()) {
    throw new Error("The Azure OpenAI assistant returned no text.");
  }

  return {
    conversationMessages: [
      ...conversationMessages,
      { role: "user", content: message },
      { role: "assistant", content: assistantReply.trim() }
    ].slice(-20),
    reply: assistantReply.trim()
  };
}

async function reply(conversationId, message, conversationMessages = []) {
  const azureOpenAIConfig = getAzureOpenAIConfig();
  if (azureOpenAIConfig) {
    return replyWithAzureOpenAI(conversationMessages, message, azureOpenAIConfig);
  }

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
