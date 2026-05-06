import jwt from "jsonwebtoken";
import { CONFIG } from "../../config.js";
import { getDocumentType, getExtension, isEditable } from "./file-utils.js";

type CreateEditorConfigParams = {
  sessionId: string;
  fileName: string;
  fileUrl: string;
  mode: "edit" | "view";
};

type CreateEditorConfigDeps = {
  getDocumentType?: typeof getDocumentType;
  isEditable?: typeof isEditable;
  jwtAlgorithm?: typeof CONFIG.DOCUMENT_SERVER_JWT_ALGORITHM;
  jwtExpiresIn?: typeof CONFIG.DOCUMENT_SERVER_JWT_EXPIRES_IN;
  jwtSecret?: typeof CONFIG.DOCUMENT_SERVER_JWT_SECRET;
  signJwt?: typeof jwt.sign;
};

export async function createEditorConfig(
  {
    sessionId,
    fileName,
    fileUrl,
    mode,
  }: CreateEditorConfigParams,
  deps: CreateEditorConfigDeps = {},
) {
  const getType = deps.getDocumentType ?? getDocumentType;
  const getIsEditable = deps.isEditable ?? isEditable;
  const extension = getExtension(fileName);

  const config = {
    document: {
      fileType: extension,
      key: sessionId,
      title: fileName,
      url: fileUrl,
      permissions: {
        edit: await getIsEditable(extension),
      }
    },
    documentType: await getType(extension),
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
    token: (deps.signJwt ?? jwt.sign)(config, deps.jwtSecret ?? CONFIG.DOCUMENT_SERVER_JWT_SECRET, {
      algorithm: deps.jwtAlgorithm ?? CONFIG.DOCUMENT_SERVER_JWT_ALGORITHM,
      expiresIn: deps.jwtExpiresIn ?? CONFIG.DOCUMENT_SERVER_JWT_EXPIRES_IN,
    }),
  };
}
