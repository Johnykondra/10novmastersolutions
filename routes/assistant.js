const express = require("express");
const assistantService = require("../services/assistantService");

const router = express.Router();
const maxMessageLength = 2000;
const requestsPerMinute = 8;

router.post("/", express.json({ limit: "4kb" }), async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > maxMessageLength) {
    return res.status(400).json({
      error: `Enter a message between 1 and ${maxMessageLength} characters.`
    });
  }

  const now = Date.now();
  const windowStartedAt = req.session.assistantWindowStartedAt || now;
  const requestCount = now - windowStartedAt >= 60_000
    ? 0
    : req.session.assistantRequestCount || 0;
  if (requestCount >= requestsPerMinute) {
    return res.status(429).json({ error: "Please wait a minute before sending more messages." });
  }

  req.session.assistantWindowStartedAt = requestCount === 0 ? now : windowStartedAt;
  req.session.assistantRequestCount = requestCount + 1;

  try {
    const result = await assistantService.reply(
      req.session.assistantConversationId,
      message
    );
    req.session.assistantConversationId = result.conversationId;
    return res.json({ reply: result.reply });
  } catch (error) {
    console.error("AI assistant request failed:", error.message);
    return res.status(502).json({
      error: "The assistant is temporarily unavailable. Please try again shortly."
    });
  }
});

router.post("/reset", express.json({ limit: "1kb" }), (req, res) => {
  delete req.session.assistantConversationId;
  return res.json({ ok: true });
});

router.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "The request is too large." });
  }
  return next(error);
});

module.exports = router;
