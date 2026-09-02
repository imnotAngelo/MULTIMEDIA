import path from 'node:path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import pdfParser from 'pdf-parse';

const PLACEHOLDER_CONTENT = /^(Original PDF uploaded:|Converted presentation generated from|Lesson content for |No readable text was found)/i;

export const MAX_QUIZ_SOURCE_CHARS = 24000;

export function isThinLessonContent(text: string, minLength = 50): boolean {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length < minLength) return true;
  return PLACEHOLDER_CONTENT.test(normalized);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function textFromOpenXml(xml: string): string {
  const matches = [...String(xml || '').matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)];
  if (matches.length > 0) {
    return matches
      .map((match) => decodeXmlEntities(match[1] || '').trim())
      .filter(Boolean)
      .join(' ');
  }

  return decodeXmlEntities(String(xml || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const data = await pdfParser(buffer);
  return String(data?.text || '').replace(/\u0000/g, ' ').trim();
}

export async function extractTextFromPptxBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1] || 0) - Number(b.match(/(\d+)/)?.[1] || 0));

  const notesNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1] || 0) - Number(b.match(/(\d+)/)?.[1] || 0));

  const parts: string[] = [];
  for (const name of [...slideNames, ...notesNames]) {
    const xml = await zip.file(name)?.async('string');
    const slideText = textFromOpenXml(xml || '');
    if (slideText) parts.push(slideText);
  }

  return parts.join('\n\n').trim();
}

export function extractTextFromPptBuffer(buffer: Buffer): string {
  const ascii = buffer.toString('latin1').match(/[\t\n\r\x20-\x7E]{6,}/g) || [];
  const utf16 = buffer.toString('utf16le').match(/[\t\n\r\x20-\x7E]{6,}/g) || [];
  const noise = /^(Root Entry|PowerPoint Document|Current User|Pictures|ObjectPool|SummaryInformation)/i;

  return [...ascii, ...utf16]
    .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter((chunk) => chunk.length >= 6 && !noise.test(chunk))
    .join('\n')
    .trim();
}

export async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return String(result?.value || '').trim();
}

export function extractTextFromPlainTextBuffer(buffer: Buffer): string {
  return buffer.toString('utf8').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
}

function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('utf8') === '%PDF-';
}

function looksLikeZip(buffer: Buffer): boolean {
  return buffer.subarray(0, 2).toString('utf8') === 'PK';
}

export async function extractTextFromLessonFile(
  buffer: Buffer,
  fileName = '',
  originalFormat = '',
): Promise<string> {
  const extension = path.extname(fileName).toLowerCase().replace('.', '');
  const format = String(originalFormat || '').toLowerCase().replace('.', '');
  // Lesson metadata is authoritative when a legacy URL has the wrong extension.
  const kind = format || extension;

  try {
    if (kind === 'pptx' || (looksLikeZip(buffer) && format === 'pptx')) {
      return await extractTextFromPptxBuffer(buffer);
    }
    if (kind === 'ppt' || format === 'ppt') {
      return extractTextFromPptBuffer(buffer);
    }
    if (kind === 'pdf' || looksLikePdf(buffer) || format === 'pdf') {
      return await extractTextFromPdfBuffer(buffer);
    }
    if (kind === 'docx' || format === 'docx') {
      return await extractTextFromDocxBuffer(buffer);
    }
    if (kind === 'txt' || kind === 'md' || kind === 'markdown') {
      return extractTextFromPlainTextBuffer(buffer);
    }
    if (looksLikeZip(buffer)) {
      const zip = await JSZip.loadAsync(buffer);
      if (Object.keys(zip.files).some((name) => name.startsWith('ppt/slides/'))) {
        return await extractTextFromPptxBuffer(buffer);
      }
      if (zip.file('word/document.xml')) {
        return await extractTextFromDocxBuffer(buffer);
      }
    }
  } catch (error: any) {
    console.warn('⚠️ Lesson file text extraction failed:', error?.message || error);
  }

  return '';
}

export function clipQuizSource(text: string, maxLength = MAX_QUIZ_SOURCE_CHARS): string {
  const normalized = String(text || '').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}
