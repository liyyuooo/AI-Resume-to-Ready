// 配置PDF.js worker (仅客户端)
const getPdfLib = async () => {
  if (typeof window === 'undefined') {
    throw new Error('PDF解析仅在浏览器环境中可用');
  }

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  return pdfjsLib;
};

export async function parsePDF(file: File): Promise<string> {
  const pdfjsLib = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => 'str' in item)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText.trim();
}

export async function parseWord(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

export async function parseResumeFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return parsePDF(file);
    case 'doc':
    case 'docx':
      return parseWord(file);
    case 'txt':
      return file.text();
    default:
      throw new Error(`不支持的文件格式: ${extension}`);
  }
}

export function isSupportedFileType(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ['pdf', 'doc', 'docx', 'txt'].includes(extension || '');
}
