import jwt from "jsonwebtoken";
import { CONFIG } from "../../config.js";
import { getDocumentType, getExtension } from "./document-type.js";

type CreateEditorConfigParams = {
  sessionId: string;
  fileName: string;
  fileUrl: string;
};

export function createEditorConfig({
  sessionId,
  fileName,
  fileUrl,
}: CreateEditorConfigParams) {
  const extension = getExtension(fileName);

  const config = {
    document: {
      fileType: extension,
      key: sessionId,
      title: fileName,
      url: fileUrl,
    },
    documentType: getDocumentType(extension),
    editorConfig: {
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
