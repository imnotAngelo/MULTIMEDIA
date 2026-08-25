import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import pdfParser from 'pdf-parse';
import PptxGenJS from 'pptxgenjs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const router = Router();
const standardFontDataUrl = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/pdfjs-dist/standard_fonts/');
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
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePlainHeading(line: string, nextLine?: string): boolean {
  const value = line.trim();
  if (!value || value.length > 90 || !nextLine?.trim()) return false;
  if (/^[-*+]\s+/.test(value) || /[.!?,;:]$/.test(value)) return false;
  if (/^(chapter|unit|module|lesson|topic|part|section)\b/i.test(value)) return true;
  if (/^\d+(?:\.\d+)*[.)]?\s+/.test(value)) return true;
  const words = value.split(/\s+/).filter(Boolean);
  const uppercaseLetters = value.replace(/[^A-Z]/g, '').length;
  const letters = value.replace(/[^A-Za-z]/g, '').length;
  const titleCase = words.length <= 12 && words.every((word) => !/^[a-z]/.test(word));
  return letters >= 3 && uppercaseLetters / letters > 0.65 || titleCase;
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
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections: Array<{ title: string; body: string }> = [];
  let currentTitle = fallbackTitle;
  let bodyLines: string[] = [];

  const flushSection = () => {
    const body = bodyLines.join('\n').trim();
    if (body) sections.push({ title: currentTitle, body });
    bodyLines = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const markdownHeading = /^#{1,6}\s+/.test(trimmed);
    const plainHeading = !markdownHeading && looksLikePlainHeading(trimmed, lines[index + 1]);
    if (markdownHeading || plainHeading) {
      flushSection();
      currentTitle = cleanHeading(trimmed) || fallbackTitle;
      return;
    }
    bodyLines.push(line);
  });
  flushSection();

  const slides: TextSlide[] = [];
  for (const section of sections.length ? sections : [{ title: fallbackTitle, body: text }]) {
    for (const body of chunkText(section.body)) {
      slides.push({ title: section.title, body });
    }
  }
  return slides;
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

function addTextSlide(pptx: PptxGenJS, title: string, body: string, index: number) {
  const slide = pptx.addSlide();
  slide.background = { color: '080B1C' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: index % 2 ? 'E879F9' : '67E8F9' }, line: { color: index % 2 ? 'E879F9' : '67E8F9' } });
  slide.addText(title || `Slide ${index + 1}`, { x: 0.75, y: 0.65, w: 11.7, h: 0.6, fontFace: 'Aptos Display', fontSize: 26, bold: true, color: 'F8FAFC', margin: 0, fit: 'shrink' });
  slide.addText(body, { x: 0.8, y: 1.45, w: contentWidth, h: contentHeight, fontFace: 'Aptos', fontSize: 16, color: 'D8E3F2', breakLine: false, valign: 'top', margin: 0.08, fit: 'shrink', paraSpaceAfterPt: 10 });
  slide.addText(`${index + 1}`, { x: 12.25, y: 7.05, w: 0.45, h: 0.2, fontSize: 9, color: '718096', align: 'right', margin: 0 });
}

function addImageSlide(pptx: PptxGenJS, buffer: Buffer, extension: string, fileName: string) {
  addImageDataSlide(pptx, `data:image/${extension.replace('.', '')};base64,${buffer.toString('base64')}`, fileName);
}

function addImageDataSlide(pptx: PptxGenJS, data: string, fileName: string) {
  const slide = pptx.addSlide();
  slide.background = { color: '080B1C' };
  slide.addText(fileName, { x: 0.75, y: 0.5, w: 11.7, h: 0.45, fontSize: 23, bold: true, color: 'F8FAFC', margin: 0, fit: 'shrink' });
  slide.addImage({ data, x: 0.7, y: 1.15, w: 11.9, h: 5.8, sizing: { type: 'contain', x: 0.7, y: 1.15, w: 11.9, h: 5.8 } });
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
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl, useWorkerFetch: false, isEvalSupported: false }).promise;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d') as any, viewport }).promise;
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

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Multimedia Learning';
    pptx.subject = 'Converted learning material';
    pptx.title = req.body.title || path.basename(req.file.originalname, extension);
    pptx.company = 'Multimedia Learning';

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
        let textTitle = req.body.title || 'Document';
        let slideIndex = 0;
        const flushText = () => {
          if (!textBuffer.length) return;
          const body = textBuffer.join('\n\n');
          structuredTextSlides(body, textTitle).forEach((slide) => addTextSlide(pptx, slide.title, slide.body, slideIndex++));
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

      const slides = extension === '.docx' ? [] : structuredTextSlides(text, req.body.title || path.basename(req.file!.originalname, extension));
      if (extension !== '.docx' && !slides.length) return res.status(400).json({ success: false, error: { code: 'EMPTY_FILE', message: 'The uploaded file contains no readable text' } });
      slides.forEach((slide, index) => addTextSlide(pptx, slide.title, slide.body, index));
    }

    const output = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const safeName = (req.body.title || path.basename(req.file.originalname, extension)).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'converted-presentation';
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': `attachment; filename="${safeName}.pptx"` });
    return res.send(output);
  } catch (error: any) {
    console.error('PPTX conversion error:', error);
    return res.status(500).json({ success: false, error: { code: 'CONVERSION_FAILED', message: error.message || 'Could not convert file' } });
  }
});

export default router;