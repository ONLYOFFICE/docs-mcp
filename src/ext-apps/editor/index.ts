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
const CONFIG_TOKEN_EXPIRATION_THRESHOLD_MS = 10_000;
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

  let content = result.structuredContent as ToolResultContent;

  const hostContext = app.getHostContext();
  const locale = hostContext?.locale || "en";

  if (content.config.token && isJwtExpired(content.config.token)) {
    try {
      const refreshResult = await app.callServerTool({
        name: "create_editor_config",
        arguments: {
          sessionId: content.sessionId,
          fileName: content.config.document.title,
          fileUrl: content.fileUrl || content.config.document.url,
          mode: content.config.editorConfig.mode,
        },
      });

      if (refreshResult.isError) {
        const errorMessage = refreshResult.content
          .map((item) => (item.type === "text" ? item.text : ""))
          .filter(Boolean)
          .join("\n");

        showMessageScreen(
          "Unable to refresh session",
          errorMessage ||
            "The session has expired and could not be refreshed. Please ask the assistant to open the file again.",
          "error",
        );
        return null;
      }

      content = refreshResult.structuredContent as ToolResultContent;
    } catch (error) {
      log.error("Unable to refresh config:", error);

      showMessageScreen(
        "Unable to refresh session",
        "The session has expired and could not be refreshed. Please ask the assistant to open the file again.",
        "error",
      );
      return null;
    }
  }

  content.config.editorConfig.lang = locale;
  if (content.fileUrl) {
    content.config.type = "desktop";
  } else {
    content.config.type = deviceType();
    if (
      content.config.type === "desktop" &&
      (content.config.document.permissions?.edit === false ||
        content.config.editorConfig.mode === "view")
    ) {
      content.config.type = "embedded";
    }
  }

  const docEditorClient = new DocEditorClient(
    app,
    EDITOR_CONTAINER_ID,
    content.documentServerBaseUrl,
    content.sessionId,
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
  if (!displayModeButton) return;

  displayModeButton.setAttribute("data-mode", displayMode);

  if (deviceType() === "mobile") {
    if (displayMode === "fullscreen") {
      displayModeButton.style.display = "none";
    } else {
      displayModeButton.style.display = "";
    }
  }
};

const getDisplayModeButton = (): HTMLElement | null => {
  return document.getElementById("display-mode-button");
};

const isJwtExpired = (token: string): boolean => {
  const expiresAtSeconds = getJwtExpirationTime(token);

  if (!expiresAtSeconds) {
    return true;
  }

  const expiresAtMs = expiresAtSeconds * 1000;

  return Date.now() + CONFIG_TOKEN_EXPIRATION_THRESHOLD_MS >= expiresAtMs;
};

const getJwtExpirationTime = (token: string): number | null => {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decodedPayload = JSON.parse(atob(normalizedPayload)) as {
      exp?: unknown;
    };

    return typeof decodedPayload.exp === "number" ? decodedPayload.exp : null;
  } catch (error) {
    log.error("Failed to decode token:", error);
    return null;
  }
};

const deviceType = () => {
  if (window.matchMedia("(pointer: coarse)").matches) {
    return "mobile";
  }
  return "desktop";
};
