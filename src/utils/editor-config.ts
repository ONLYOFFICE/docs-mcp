import jwt from "jsonwebtoken";
import { CONFIG } from "../config.js";
import { getDocumentType, getExtension, isEditable } from "./file-utils.js";

type CreateEditorConfigParams = {
  sessionId: string;
  fileName: string;
  fileUrl: string;
  mode: "edit" | "view";
};

export async function createEditorConfig({
  sessionId,
  fileName,
  fileUrl,
  mode,
}: CreateEditorConfigParams) {
  const extension = getExtension(fileName);

  const config = {
    document: {
      fileType: extension,
      key: sessionId,
      title: fileName,
      url: fileUrl,
      permissions: {
        edit: await isEditable(extension),
      }
    },
    documentType: await getDocumentType(extension),
    editorConfig: {
      mode,
      customization: {
        forcesave: true,
        compactHeader: true,
        compactToolbar: true,
        anonymous: {
          request: false,
        },
      },
    },
  };

  return {
    ...config,
    token: jwt.sign(config, CONFIG.DOCUMENT_SERVER_JWT_SECRET, {
      algorithm: CONFIG.DOCUMENT_SERVER_JWT_ALGORITHM,
      expiresIn: CONFIG.DOCUMENT_SERVER_JWT_EXPIRES_IN,
    }),
  };
}
