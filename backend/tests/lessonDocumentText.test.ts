import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  extractTextFromLessonFile,
  extractTextFromPptxBuffer,
  isThinLessonContent,
} from '../src/lib/lessonDocumentText.ts';

test('treats placeholder lesson copy as insufficient quiz source', () => {
  assert.equal(isThinLessonContent('Original PDF uploaded: Intro'), true);
  assert.equal(isThinLessonContent('Converted presentation generated from week-1.pptx.'), true);
  assert.equal(isThinLessonContent('Photosynthesis converts light energy into chemical energy stored in glucose.'), false);
});

test('extracts readable text from a PowerPoint lesson file', async () => {
  const zip = new JSZip();
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Photosynthesis uses sunlight to make glucose.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  );
  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Chlorophyll absorbs light in plant leaves.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const slideText = await extractTextFromPptxBuffer(buffer);
  const fileText = await extractTextFromLessonFile(buffer, 'week-1.pptx', 'pptx');

  assert.match(slideText, /Photosynthesis uses sunlight to make glucose/);
  assert.match(slideText, /Chlorophyll absorbs light in plant leaves/);
  assert.equal(fileText, slideText);
});
