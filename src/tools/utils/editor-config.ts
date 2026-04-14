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

  return {
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
}
