import { App } from "@modelcontextprotocol/ext-apps";
import { DocEditorClient } from "../doc-editor-client.js";

const app = new App({ name: "ONLYOFFICE Editor App", version: "1.0.0" });

const log = {
  info: console.log.bind(console, "[ONLYOFFICE-EDITOR]"),
  error: console.error.bind(console, "[ONLYOFFICE-EDITOR]"),
};

let toolResultTimer: ReturnType<typeof setTimeout> | null = null;

app.ontoolresult = async (result) => {
  if (toolResultTimer !== null) {
    clearTimeout(toolResultTimer);
    toolResultTimer = null;
  }

  log.info("ontoolresult:", result);

  showLoading("Waiting loading ONLYOFFICE Editor...");

  const content = result.structuredContent as {
    sessionId: string;
    documentServerBaseUrl: string;
    config: any;
    path: string | undefined;
  };

  const hostContext = app.getHostContext();
  const locale = hostContext?.locale || "en";

  content.config.editorConfig.lang = locale;

  const docEditorClient = new DocEditorClient(
    app,
    "editor",
    content.documentServerBaseUrl,
    content.sessionId
  );
  
  docEditorClient.init().then(() => {
    docEditorClient.open(content.config, content.path);

    hideLoading();
    initDisplayModeButton();
  }).catch((error) => {
    log.error("Failed to initialize DocEditorClient:", error);

    showMessageScreen(
      "ONLYOFFICE Document Server unavailable",
      "The ONLYOFFICE Document Server could not be loaded. Please check the server URL and try again.",
      "error"
    );
  });
};

app.onhostcontextchanged = (context) => {
  if (context.displayMode) {
    changeDisplayMode(context.displayMode);

    if (context.displayMode === "inline") {
      app.sendSizeChanged({
        height: 600,
      });
    }
  }
}

app.connect().then(() => {
  log.info("Connected to host");

  showLoading("Waiting tool response...");

  toolResultTimer = setTimeout(() => {
    toolResultTimer = null;
    showMessageScreen(
      "No response received",
      "Ask the AI assistant to open a file in ONLYOFFICE to get started."
    );
  }, 10_000);
});

const showLoading = (message: string): void => {
  const loading = document.getElementById("loading");
  const text = document.getElementById("loading-text");
  if (loading) loading.style.display = "";
  if (text) text.textContent = message;
}

const hideLoading = (): void => {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
}

const showMessageScreen = (title: string, description: string, variant: "idle" | "error" = "idle"): void => {
  const loading = document.getElementById("loading");
  const messageScreen = document.getElementById("message-screen");
  const iconIdle = document.getElementById("message-screen-icon-idle");
  const iconError = document.getElementById("message-screen-icon-error");
  const titleEl = document.getElementById("message-screen-title");
  const textEl = document.getElementById("message-screen-text");

  if (loading) loading.style.display = "none";
  if (iconIdle) iconIdle.style.display = variant === "idle" ? "" : "none";
  if (iconError) iconError.style.display = variant === "error" ? "" : "none";
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = description;
  if (messageScreen) messageScreen.style.display = "flex";
}

const initDisplayModeButton = () => {
  const hostContext = app.getHostContext();

  if (!hostContext || !hostContext.displayMode) return;

  const displayModeButton = getDisplayModeButton();

  displayModeButton?.classList.add("initialized");
  displayModeButton?.setAttribute("data-mode", hostContext.displayMode);

  displayModeButton?.addEventListener("click", (event: Event) => {
    const target = event.currentTarget as HTMLElement; 
    const currentMode = target.getAttribute("data-mode");
    
    app.requestDisplayMode({ mode: currentMode === "fullscreen" ? "inline" : "fullscreen" });
  });
}

const changeDisplayMode = (displayMode: string) => {
  const displayModeButton = getDisplayModeButton();

  displayModeButton?.setAttribute("data-mode", displayMode);
}

const getDisplayModeButton = (): HTMLElement | null => {
  return document.getElementById("display-mode-button");
}
