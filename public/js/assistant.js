const assistantWidget = document.querySelector(".assistant-widget");

if (assistantWidget) {
  const toggleButton = assistantWidget.querySelector(".assistant-toggle");
  const panel = assistantWidget.querySelector(".assistant-panel");
  const closeButton = assistantWidget.querySelector(".assistant-close");
  const resetButton = assistantWidget.querySelector(".assistant-reset");
  const form = assistantWidget.querySelector(".assistant-form");
  const input = assistantWidget.querySelector(".assistant-input");
  const messages = assistantWidget.querySelector(".assistant-messages");
  const submitButton = assistantWidget.querySelector(".assistant-submit");

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) input.focus();
    else toggleButton.focus();
  }

  function addMessage(text, type) {
    const message = document.createElement("p");
    message.className = `assistant-message assistant-message-${type}`;
    message.textContent = text;
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  toggleButton.addEventListener("click", () => {
    setOpen(panel.hidden);
  });
  closeButton.addEventListener("click", () => setOpen(false));

  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    try {
      const response = await fetch("/api/assistant/reset", { method: "POST" });
      if (!response.ok) throw new Error("Could not start a new conversation.");
      messages.replaceChildren();
      addMessage("Hi! I’m the Master Solutions assistant. How can I help?", "bot");
      input.focus();
    } catch (error) {
      addMessage(error.message, "error");
    } finally {
      resetButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const messageText = input.value.trim();
    if (!messageText || submitButton.disabled) return;

    addMessage(messageText, "user");
    input.value = "";
    input.disabled = true;
    submitButton.disabled = true;
    const pendingMessage = addMessage("Thinking…", "pending");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant could not respond.");
      pendingMessage.textContent = result.reply;
      pendingMessage.className = "assistant-message assistant-message-bot";
    } catch (error) {
      pendingMessage.textContent = error.message;
      pendingMessage.className = "assistant-message assistant-message-error";
    } finally {
      input.disabled = false;
      submitButton.disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  });
}
