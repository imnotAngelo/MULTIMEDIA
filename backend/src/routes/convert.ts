import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mammoth from 'mammoth';
import pdfParser from 'pdf-parse';
import PptxGenJS from 'pptxgenjs';
import { v4 as uuidv4 } from 'uuid';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { supabase } from '../config/supabase.js';
import { createLocalLesson } from '../lib/lessonStore.js';

const router = Router();
const routeDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(routeDir, '..', '..');
const uploadDir = path.join(backendRoot, 'uploads');
const standardFontsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/pdfjs-dist/standard_fonts');
const standardFontDataUrl = (() => {
  const url = pathToFileURL(standardFontsPath).href;
  return url.endsWith('/') ? url : `${url}/`;
})();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const supportedExtensions = new Set(['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.md', '.markdown', '.txt']);
const contentWidth = 11.2;
const contentHeight = 5.55;

interface TextSlide {
  title: string;
  body: string;
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[*_]+|[*_]+$/g, '')
    .replace(/^[\-•*+\d.\)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePlainHeading(line: string, nextLine?: string): boolean {
  const value = line.trim();
  if (!value || value.length > 120) return false;
  if (/^[-*+]\s+/.test(value) || /^\d+\s*[:.)-]\s*/.test(value) || /[.!?,;:]$/.test(value)) return false;
  if (/^(chapter|unit|module|lesson|topic|part|section)\b/i.test(value)) return true;
  if (/^\d+(?:\.\d+)*[.)]?\s+/.test(value)) return true;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 12) return false;

  const letters = value.replace(/[^A-Za-z]/g, '').length;
  const uppercaseLetters = value.replace(/[^A-Z]/g, '').length;
  const isTitleCase = words.every((word) => {
    if (!/[A-Za-z]/.test(word)) return true;
    if (word.length <= 2) return true;
    return /^[A-Z][a-z0-9'\-]*$/.test(word)
      || /^[A-Z0-9]+$/.test(word)
      || /^(the|and|for|of|to|in|on|at|by|a|an|or|but|if|as|is|it|be|with|that|this|from|into|via)$/i.test(word);
  });
  const hasContinuation = !!nextLine?.trim() && !/[.!?]$/.test(nextLine.trim()) && nextLine.trim().length <= 90;
  return letters >= 3 && (uppercaseLetters / letters > 0.45 || isTitleCase || hasContinuation);
}

function mergeWrappedHeading(lines: string[], startIndex: number): { title: string; nextIndex: number } | null {
  const first = lines[startIndex]?.trim();
  if (!first || !looksLikePlainHeading(first, lines[startIndex + 1])) return null;

  const merged: string[] = [first];
  let i = startIndex + 1;

  while (i < lines.length && merged.length < 3) {
    const next = lines[i].trim();
    if (!next || next.length > 80 || /^[-*•+\d.\)]\s*/.test(next) || /[.!?]$/.test(next)) break;

    const candidate = `${merged[merged.length - 1]} ${next}`.replace(/\s+/g, ' ').trim();
    if (candidate.length > 120) break;

    merged[merged.length - 1] = candidate;
    i += 1;
  }

  if (merged.length === 1 && lines[startIndex + 1] && looksLikePlainHeading(`${first} ${lines[startIndex + 1]}`.trim(), lines[startIndex + 2])) {
    const combined = `${first} ${lines[startIndex + 1]}`.replace(/\s+/g, ' ').trim();
    return { title: cleanHeading(combined), nextIndex: startIndex + 2 };
  }

  return { title: cleanHeading(merged.join(' ')), nextIndex: i };
}

export function buildPresentationSections(text: string, fallbackTitle: string): TextSlide[] {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const lines = rawLines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);

  if (!lines.length) {
    return [{ title: fallbackTitle || 'Document Overview', body: 'No readable text was found in the uploaded document.' }];
  }

  const sections: TextSlide[] = [];
  let currentBody: string[] = [];
  let i = 0;

  const flushBody = (headingTitle: string) => {
    const body = currentBody.join('\n\n').trim();
    if (body) sections.push({ title: headingTitle, body });
    currentBody = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    const heading = mergeWrappedHeading(lines, i) || (looksLikePlainHeading(line, nextLine) ? { title: cleanHeading(line), nextIndex: i + 1 } : null);

    if (heading) {
      if (currentBody.length) {
        flushBody(fallbackTitle || 'Overview');
      }
      sections.push({ title: heading.title, body: '' });
      i = heading.nextIndex;
      const bodyLines: string[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const followingLine = lines[i + 1];
        const nextHeading = mergeWrappedHeading(lines, i) || (looksLikePlainHeading(current, followingLine) ? { title: cleanHeading(current), nextIndex: i + 1 } : null);
        if (nextHeading) break;
        bodyLines.push(current);
        i += 1;
      }
      const finalBody = bodyLines.join('\n\n').trim();
      const targetIndex = sections.length - 1;
      sections[targetIndex].body = finalBody || 'No supporting details were found for this section.';
      continue;
    }

    currentBody.push(line);
    i += 1;
  }

  if (currentBody.length) {
    flushBody(fallbackTitle || 'Overview');
  }

  const normalized = (sections.length ? sections : [{ title: fallbackTitle || 'Document Overview', body: text.trim() }])
    .map((section) => ({
      title: section.title || fallbackTitle || 'Document Overview',
      body: section.body && section.body.trim() ? section.body.trim() : 'No supporting details were found for this section.',
    }));

  return normalized.flatMap((section) => {
    const chunked = chunkText(section.body || '');
    return chunked.length ? chunked.map((body) => ({ title: section.title, body })) : [{ title: section.title, body: section.body }];
  });
}

function chunkText(text: string, maxCharacters = 900): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\s*\n/).map((part) => part.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxCharacters) {
      chunks.push(paragraph);
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
    let current = '';
    for (const sentence of sentences.length ? sentences : [paragraph]) {
      if (sentence.length > maxCharacters) {
        if (current) chunks.push(current);
        current = '';
        for (let start = 0; start < sentence.length; start += maxCharacters) chunks.push(sentence.slice(start, start + maxCharacters));
      } else if (current && `${current} ${sentence}`.length > maxCharacters) {
        chunks.push(current);
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

function structuredTextSlides(text: string, fallbackTitle: string): TextSlide[] {
  return buildPresentationSections(text, fallbackTitle);
}

export function buildConvertedLessonRecord({
  id,
  unitId,
  moduleId,
  title,
  content,
  fileUrl,
  pdfUrl,
  originalFormat = 'pptx',
}: {
  id?: string;
  unitId?: string | null;
  moduleId?: string | null;
  title: string;
  content?: string;
  fileUrl?: string;
  pdfUrl?: string;
  originalFormat?: string;
}) {
  const normalizedUnitId = unitId || moduleId || null;
  const normalizedFileUrl = fileUrl || pdfUrl || '';

  return {
    id: id || uuidv4(),
    lessonId: id || uuidv4(),
    unitId: normalizedUnitId,
    moduleId: normalizedUnitId,
    title,
    content: content || `Converted presentation generated from ${title}.`,
    createdAt: new Date().toISOString(),
    slideCount: 0,
    slides: [],
    pdfUrl: normalizedFileUrl,
    fileUrl: normalizedFileUrl,
    downloadUrl: normalizedFileUrl,
    videoUrl: '',
    graphicUrl: '',
    originalFormat,
    stored: true,
    message: 'Presentation converted and saved as a lesson.',
  };
}

interface DocxBlock {
  type: 'text' | 'image';
  text?: string;
  title?: string;
  data?: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDocxHtml(html: string): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  const blockPattern = /<img\b[^>]*\bsrc="(data:[^"]+)"[^>]*>|<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\2>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(html))) {
    if (match[1]) {
      blocks.push({ type: 'image', data: match[1] });
      continue;
    }
    const tag = match[2]?.toLowerCase();
    const text = decodeHtml(match[3] || '');
    if (!text) continue;
    blocks.push({
      type: 'text',
      title: tag?.startsWith('h') ? text : undefined,
      text: tag === 'li' ? `• ${text}` : text,
    });
  }
  return blocks;
}

function getSectionTheme(index: number) {
  const themes = [
    { primary: '67E8F9', secondary: '0EA5E9', accent: 'E0F2FE', panel: '0F172A' },
    { primary: 'A78BFA', secondary: '8B5CF6', accent: 'EDE9FE', panel: '1F1635' },
    { primary: 'F9A8D4', secondary: 'EC4899', accent: 'FCE7F3', panel: '2E1324' },
    { primary: '86EFAC', secondary: '22C55E', accent: 'DCFCE7', panel: '12251B' },
  ];
  return themes[index % themes.length];
}

function addTitleSlide(pptx: PptxGenJS, title: string, subtitle?: string) {
  const slide = pptx.addSlide();
  slide.background = { color: '0B1020' };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: '0F172A' },
    line: { color: '0F172A' },
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.38,
    fill: { color: '67E8F9' },
    line: { color: '67E8F9' },
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.85,
    y: 1.1,
    w: 11.7,
    h: 4.8,
    fill: { color: '111827' },
    line: { color: '334155', pt: 1 },
  });

  slide.addText('ACADEMIC LESSON', {
    x: 1.2,
    y: 1.45,
    w: 3.2,
    h: 0.35,
    fontFace: 'Aptos',
    fontSize: 11,
    bold: true,
    color: '67E8F9',
    margin: 0,
    fit: 'shrink',
  });

  slide.addText(title || 'Course Presentation', {
    x: 1.2,
    y: 2.1,
    w: 10.8,
    h: 1.5,
    fontFace: 'Aptos Display',
    fontSize: 28,
    bold: true,
    color: 'F8FAFC',
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });

  slide.addText(subtitle || 'Prepared for classroom discussion and guided study', {
    x: 1.2,
    y: 3.9,
    w: 8.4,
    h: 0.6,
    fontFace: 'Aptos',
    fontSize: 15,
    color: 'CBD5E1',
    margin: 0,
    fit: 'shrink',
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 1.2,
    y: 4.85,
    w: 4.2,
    h: 0,
    fill: { color: '67E8F9' },
    line: { color: '67E8F9', pt: 3 },
  });

  slide.addText('Learning objectives • Key concepts • Discussion prompts', {
    x: 1.2,
    y: 5.25,
    w: 9.8,
    h: 0.55,
    fontFace: 'Aptos',
    fontSize: 12,
    color: 'E2E8F0',
    margin: 0,
    fit: 'shrink',
  });
}

function addTextSlide(pptx: PptxGenJS, title: string, body: string, index: number, options?: { isOverview?: boolean; callout?: string }) {
  const slide = pptx.addSlide();
  const theme = getSectionTheme(index);
  const isOverview = Boolean(options?.isOverview);
  const callout = options?.callout?.trim();

  slide.background = { color: '0B1020' };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.38,
    fill: { color: theme.primary },
    line: { color: theme.primary },
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 0.75,
    w: 0.2,
    h: 0.7,
    fill: { color: theme.primary },
    line: { color: theme.primary },
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.9,
    y: 1.6,
    w: 11.55,
    h: 4.95,
    fill: { color: theme.panel },
    line: { color: '24314D', pt: 1 },
  });

  slide.addText(isOverview ? 'OVERVIEW' : `SECTION ${index + 1}`.padEnd(12, ' '), {
    x: 0.95,
    y: 0.18,
    w: 2.2,
    h: 0.18,
    fontFace: 'Aptos',
    fontSize: 9,
    bold: true,
    color: '08111F',
    margin: 0,
    fit: 'shrink',
  });

  slide.addText(title || `Slide ${index + 1}`, {
    x: 0.95,
    y: 0.72,
    w: 11.1,
    h: 0.82,
    fontFace: 'Aptos Display',
    fontSize: 24,
    bold: true,
    color: 'F8FAFC',
    margin: 0,
    fit: 'shrink',
    breakLine: true,
  });

  const bodyLines = body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const displayBody = bodyLines.length > 1 ? bodyLines.join('\n\n') : body;

  slide.addText(displayBody, {
    x: 1.25,
    y: 1.9,
    w: 8.9,
    h: 4.15,
    fontFace: 'Aptos',
    fontSize: 15,
    color: 'E2E8F0',
    valign: 'top',
    margin: 0.08,
    fit: 'shrink',
    breakLine: true,
    paraSpaceAfter: 8,
    bullet: { indent: 0.18, type: 'bullet' },
  });

  if (callout) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.9,
      y: 2.05,
      w: 2.15,
      h: 2.9,
      fill: { color: theme.accent },
      line: { color: theme.primary, pt: 1 },
    });

    slide.addText('Key takeaway', {
      x: 10.15,
      y: 2.25,
      w: 1.7,
      h: 0.35,
      fontFace: 'Aptos',
      fontSize: 9,
      bold: true,
      color: '0F172A',
      margin: 0,
      fit: 'shrink',
    });

    slide.addText(callout, {
      x: 10.15,
      y: 2.75,
      w: 1.7,
      h: 1.7,
      fontFace: 'Aptos',
      fontSize: 11,
      color: '0F172A',
      margin: 0.06,
      fit: 'shrink',
      breakLine: true,
    });
  }

  slide.addText(`${index + 1}`, {
    x: 12.38,
    y: 6.8,
    w: 0.6,
    h: 0.2,
    fontSize: 9,
    color: '94A3B8',
    align: 'right',
    margin: 0,
  });
}

function addImageSlide(pptx: PptxGenJS, buffer: Buffer, extension: string, fileName: string) {
  addImageDataSlide(pptx, `data:image/${extension.replace('.', '')};base64,${buffer.toString('base64')}`, fileName);
}

function addImageDataSlide(pptx: PptxGenJS, data: string, fileName: string) {
  const slide = pptx.addSlide();
  slide.background = { color: '0B1020' };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.38,
    fill: { color: '67E8F9' },
    line: { color: '67E8F9' },
  });

  slide.addText(fileName, {
    x: 0.8,
    y: 0.7,
    w: 11.5,
    h: 0.5,
    fontFace: 'Aptos Display',
    fontSize: 22,
    bold: true,
    color: 'F8FAFC',
    margin: 0,
    fit: 'shrink',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.7,
    y: 1.35,
    w: 11.9,
    h: 5.5,
    fill: { color: '111827' },
    line: { color: '334155', pt: 1 },
  });

  slide.addImage({
    data,
    x: 0.96,
    y: 1.62,
    w: 11.35,
    h: 4.95,
    sizing: { type: 'contain', x: 0.96, y: 1.62, w: 11.35, h: 4.95 },
  });
}

function extractPageText(items: any[]): string {
  const lines: Array<{ y: number; text: string }> = [];
  for (const item of items) {
    const text = String(item.str || '').trim();
    if (!text) continue;
    const y = Array.isArray(item.transform) ? Number(item.transform[5]) : 0;
    const line = lines.find((entry) => Math.abs(entry.y - y) <= 2);
    if (line) line.text += ` ${text}`;
    else lines.push({ y, text });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function addPdfSlides(pptx: PptxGenJS, buffer: Buffer, fileName: string) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl, useWorkerFetch: false }).promise;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as any, canvasContext: canvas.getContext('2d') as any, viewport }).promise;
    const pageText = extractPageText((await page.getTextContent()).items);
    const slide = pptx.addSlide();
    slide.background = { color: '080B1C' };
    slide.addImage({
      data: `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`,
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      sizing: { type: 'contain', x: 0, y: 0, w: 13.333, h: 7.5 },
    });
    slide.addText(`${fileName}  |  Page ${pageNumber} of ${document.numPages}`, {
      x: 0.25,
      y: 7.18,
      w: 12.8,
      h: 0.18,
      fontSize: 7,
      color: '94A3B8',
      margin: 0,
      align: 'right',
      transparency: 20,
    });
    if (pageText && typeof (slide as any).addNotes === 'function') {
      (slide as any).addNotes(`Extracted text from source page ${pageNumber}:\n\n${pageText}`);
    }
  }
}

router.post('/pptx', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'Please upload a file' } });
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (!supportedExtensions.has(extension)) return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_FILE', message: 'Supported files: PDF, DOCX, images, Markdown, and TXT' } });

    const title = String(req.body.title || path.basename(req.file.originalname, extension) || 'Converted Lesson').trim();
    const unitId = String(req.body.unitId || req.body.moduleId || '').trim();
    const lessonModuleId = unitId || null;

    if (lessonModuleId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lessonModuleId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_UNIT_ID', message: `Invalid unit ID format. Expected UUID, got: "${lessonModuleId}"` },
      });
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Multimedia Learning';
    pptx.subject = 'Converted learning material';
    pptx.title = title;
    pptx.company = 'Multimedia Learning';

    const presentationTitle = title;
    addTitleSlide(pptx, presentationTitle, 'Prepared for classroom discussion and guided study');

    if (extension === '.pdf') {
      await addPdfSlides(pptx, req.file.buffer, req.file.originalname);
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
      addImageSlide(pptx, req.file.buffer, extension, req.file.originalname);
    } else {
      let text = '';
      if (extension === '.pdf') text = (await pdfParser(req.file.buffer)).text;
      else if (extension === '.docx') {
        const html = (await mammoth.convertToHtml({ buffer: req.file.buffer }, {
          convertImage: mammoth.images.imgElement((image: any) => image.read('base64').then((imageBuffer: string) => ({
            src: `data:${image.contentType};base64,${imageBuffer}`,
          }))),
        })).value;
        const blocks = parseDocxHtml(html);
        let textBuffer: string[] = [];
        let textTitle = title;
        let slideIndex = 0;
        const flushText = () => {
          if (!textBuffer.length) return;
          const body = textBuffer.join('\n\n');
          const slides = structuredTextSlides(body, textTitle);
          if (slides.length > 1) {
            const overviewBody = slides.slice(0, Math.min(4, slides.length)).map((slide, idx) => `• ${idx + 1}. ${slide.title}`).join('\n');
            addTextSlide(pptx, 'Overview', overviewBody, slideIndex++, { isOverview: true, callout: 'Lesson structure and section flow' });
          }
          slides.forEach((slide) => addTextSlide(pptx, slide.title, slide.body, slideIndex++, { callout: slide.title }));
          textBuffer = [];
        };
        for (const block of blocks) {
          if (block.type === 'image' && block.data) {
            flushText();
            addImageDataSlide(pptx, block.data, `Image ${slideIndex + 1}`);
            slideIndex += 1;
          } else if (block.title) {
            flushText();
            textTitle = block.title;
          } else if (block.text) {
            textBuffer.push(block.text);
          }
        }
        flushText();
        if (slideIndex === 0) return res.status(400).json({ success: false, error: { code: 'EMPTY_FILE', message: 'The DOCX contains no readable text or images' } });
      }
      else text = req.file.buffer.toString('utf8');

      const slides = extension === '.docx' ? [] : structuredTextSlides(text, title);
      if (extension !== '.docx' && !slides.length) return res.status(400).json({ success: false, error: { code: 'EMPTY_FILE', message: 'The uploaded file contains no readable text' } });

      if (extension !== '.docx' && slides.length > 1) {
        const overviewBody = slides.slice(0, Math.min(4, slides.length)).map((slide, idx) => `• ${idx + 1}. ${slide.title}`).join('\n');
        addTextSlide(pptx, 'Overview', overviewBody, 0, { isOverview: true, callout: 'Lesson structure and section flow' });
      }

      slides.forEach((slide, index) => addTextSlide(pptx, slide.title, slide.body, slides.length > 1 ? index + 1 : index, { callout: slide.title }));
    }

    const output = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const safeName = title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'converted-presentation';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${safeName}-${Date.now()}.pptx`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, output);
    const fileUrl = `/uploads/${fileName}`;

    const lessonId = uuidv4();
    const content = `Converted presentation generated from ${path.basename(req.file.originalname)}.`;
    const lessonPayload = {
      id: lessonId,
      module_id: lessonModuleId,
      title,
      content,
      slides: [],
      slide_count: 0,
      xp_reward: 25,
      order_index: 1,
      status: 'published',
      pdf_url: fileUrl,
      original_format: 'pptx',
      video_url: null,
      graphic_url: null,
      created_at: new Date().toISOString(),
    };

    let savedLesson: any = null;
    if (supabase && lessonModuleId) {
      try {
        const { data: moduleRow, error: moduleError } = await supabase
          .from('modules')
          .select('id')
          .eq('id', lessonModuleId)
          .maybeSingle();

        if (moduleError) throw moduleError;
        if (!moduleRow) {
          throw new Error(`Selected unit ${lessonModuleId} does not exist`);
        }

        const { data, error } = await supabase.from('lessons').insert(lessonPayload).select('id, title, module_id, pdf_url, original_format').single();
        if (error) throw error;
        savedLesson = data;
      } catch (error: any) {
        console.warn('Converted PPT lesson save to Supabase failed, falling back to local lesson store:', error.message);
      }
    }

    if (!savedLesson) {
      const localLesson = createLocalLesson({
        id: lessonId,
        moduleId: lessonModuleId || 'local-unit',
        title,
        content: lessonPayload.content,
        slides: [],
        slideCount: 0,
        status: 'published',
        createdAt: new Date().toISOString(),
        pdfUrl: fileUrl,
        originalFormat: 'pptx',
      });
      savedLesson = {
        id: localLesson.id,
        title: localLesson.title,
        module_id: localLesson.moduleId || lessonModuleId,
        pdf_url: localLesson.pdfUrl || fileUrl,
        original_format: localLesson.originalFormat || 'pptx',
      };
    }

    const lessonRecord = buildConvertedLessonRecord({
      id: savedLesson?.id || lessonId,
      unitId: lessonModuleId || savedLesson?.module_id || null,
      moduleId: lessonModuleId || savedLesson?.module_id || null,
      title,
      content,
      fileUrl,
      pdfUrl: fileUrl,
      originalFormat: 'pptx',
    });

    return res.status(201).json({
      success: true,
      data: lessonRecord,
    });
  } catch (error: any) {
    console.error('PPTX conversion error:', error);
    return res.status(500).json({ success: false, error: { code: 'CONVERSION_FAILED', message: error.message || 'Could not convert file' } });
  }
});

export default router;