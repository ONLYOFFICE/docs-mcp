import { App } from "@modelcontextprotocol/ext-apps";
import { DocEditorClient, type EditorConfig } from "./doc-editor-client.js";
import packageJson from "../../../package.json" with { type: "json" };

const app = new App(
  {
    name: "ONLYOFFICE Editor",
    version: packageJson.version,
  },
  {},
  {
    autoResize: false,
  },
);

const log = {
  info: console.log.bind(console, "[ONLYOFFICE-EDITOR]"),
  error: console.error.bind(console, "[ONLYOFFICE-EDITOR]"),
};

const TOOL_RESULT_TIMEOUT_MS = 10_000;
const INLINE_EDITOR_HEIGHT = 600;
const EDITOR_CONTAINER_ID = "editor";

let toolResultTimer: ReturnType<typeof setTimeout> | null = null;

type ToolResultContent = {
  sessionId: string;
  documentServerBaseUrl: string;
  shardkey: string;
  config: EditorConfig;
  fileUrl: string | undefined;
};

app.ontoolresult = async (result) => {
  log.info("Tool result received (ontoolresult)");

  if (toolResultTimer !== null) {
    clearTimeout(toolResultTimer);
    toolResultTimer = null;
  }

  showLoading("Waiting loading ONLYOFFICE Editor...");

  const content = result.structuredContent as ToolResultContent;

  const hostContext = app.getHostContext();
  const locale = hostContext?.locale || "en";

  content.config.editorConfig.lang = locale;
  content.config.type = deviceType();

  const docEditorClient = new DocEditorClient(
    app,
    EDITOR_CONTAINER_ID,
    content.documentServerBaseUrl,
  );

  log.info("Initializing DocEditorClient, sessionId:", content.sessionId);

  docEditorClient
    .init(content.shardkey)
    .then(() => {
      docEditorClient.open(content.config, content.fileUrl);

      app.sendSizeChanged({
        height: INLINE_EDITOR_HEIGHT,
      });

      hideLoading();
      initDisplayModeButton();
    })
    .catch((error) => {
      log.error("Failed to initialize DocEditorClient:", error);

      showMessageScreen(
        "ONLYOFFICE Document Server unavailable",
        "The ONLYOFFICE Document Server could not be loaded. Please check the server URL and try again.",
        "error",
      );
    });
};

app.onhostcontextchanged = (context) => {
  if (context.displayMode) {
    log.info("Display mode changed:", context.displayMode);
    changeDisplayMode(context.displayMode);

    if (context.displayMode === "inline") {
      app.sendSizeChanged({
        height: INLINE_EDITOR_HEIGHT,
      });
    }
  }
};

app.connect().then(() => {
  log.info("Connected to host");

  showLoading("Waiting tool response...");

  toolResultTimer = setTimeout(() => {
    toolResultTimer = null;
    log.info(
      `Tool result timeout (ontoolresult) — no result received within ${TOOL_RESULT_TIMEOUT_MS / 1000} s`,
    );
    showMessageScreen(
      "No response received",
      "Ask the AI assistant to open a file in ONLYOFFICE to get started.",
    );
  }, TOOL_RESULT_TIMEOUT_MS);
});

const showLoading = (message: string): void => {
  const loading = document.getElementById("loading");
  const text = document.getElementById("loading-text");
  if (loading) loading.style.display = "";
  if (text) text.textContent = message;
};

const hideLoading = (): void => {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
};

const showMessageScreen = (
  title: string,
  description: string,
  variant: "idle" | "error" = "idle",
): void => {
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
};

const initDisplayModeButton = () => {
  const hostContext = app.getHostContext();

  if (!hostContext || !hostContext.displayMode) return;

  const displayModeButton = getDisplayModeButton();

  displayModeButton?.classList.add("initialized");
  displayModeButton?.setAttribute("data-mode", hostContext.displayMode);

  displayModeButton?.addEventListener("click", (event: Event) => {
    const target = event.currentTarget as HTMLElement;
    const currentMode = target.getAttribute("data-mode");

    app.requestDisplayMode({
      mode: currentMode === "fullscreen" ? "inline" : "fullscreen",
    });
  });
};

const changeDisplayMode = (displayMode: string) => {
  const displayModeButton = getDisplayModeButton();

  displayModeButton?.setAttribute("data-mode", displayMode);
};

const getDisplayModeButton = (): HTMLElement | null => {
  return document.getElementById("display-mode-button");
};

const deviceType = () => {
  if (window.matchMedia("(pointer: coarse)").matches) {
    return "mobile";
  }
  return "embedded";
};
