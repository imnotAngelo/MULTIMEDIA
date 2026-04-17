import { jsPDF } from 'jspdf';

/**
 * Download lesson slides as JSON
 */
export function downloadLessonAsJSON(lesson: any, filename?: string) {
  const lessonData = {
    title: lesson.title,
    createdAt: lesson.createdAt,
    slideCount: lesson.slides?.length || 0,
    slides: lesson.slides || [],
  };

  const dataStr = JSON.stringify(lessonData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${lesson.title.replace(/\s+/g, '-')}-lesson.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download lesson slides as HTML (printable format)
 */
export function downloadLessonAsHTML(lesson: any, filename?: string) {
  const html = generateLessonHTML(lesson);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${lesson.title.replace(/\s+/g, '-')}-lesson.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate HTML content for lesson
 */
function generateLessonHTML(lesson: any): string {
  const slides = lesson.slides || [];
  const slidesHTML = slides
    .map(
      (slide: any, idx: number) => `
    <div class="slide" style="page-break-after: always; padding: 40px; font-family: Arial, sans-serif;">
      <h2 style="color: #6366f1; margin-bottom: 20px;">Slide ${idx + 1}: ${slide.title || 'Untitled'}</h2>
      <div style="margin-bottom: 20px; line-height: 1.6;">
        ${slide.content?.replace(/\n/g, '<br/>') || ''}
      </div>
      ${
        slide.summary
          ? `<div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; margin-bottom: 20px;">
          <strong>Summary:</strong> ${slide.summary}
        </div>`
          : ''
      }
      ${
        slide.keyPoints && slide.keyPoints.length > 0
          ? `<div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
          <strong style="color: #6366f1;">Key Points:</strong>
          <ul style="margin-top: 10px;">
            ${slide.keyPoints.map((point: string) => `<li style="margin-bottom: 8px;">${point}</li>`).join('')}
          </ul>
        </div>`
          : ''
      }
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${lesson.title}</title>
    <style>
      body {
        margin: 0;
        padding: 20px;
        background-color: #f3f4f6;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        background-color: white;
      }
      .header {
        padding: 40px;
        border-bottom: 3px solid #6366f1;
        margin-bottom: 30px;
      }
      .header h1 {
        margin: 0;
        color: #1f2937;
        font-size: 2.5em;
      }
      .header p {
        color: #6b7280;
        margin: 10px 0 0 0;
      }
      .slide {
        page-break-after: always;
        padding: 40px;
        font-family: Arial, sans-serif;
      }
      .slide h2 {
        color: #6366f1;
        margin-bottom: 20px;
        font-size: 1.8em;
      }
      ul {
        margin: 10px 0;
        padding-left: 20px;
      }
      li {
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${lesson.title}</h1>
        <p>Created: ${new Date(lesson.createdAt).toLocaleDateString()}</p>
        <p>Total Slides: ${slides.length}</p>
      </div>
      ${slidesHTML}
    </div>
  </body>
</html>
  `;
}

/**
 * Download lesson slides as CSV (for spreadsheet applications)
 */
export function downloadLessonAsCSV(lesson: any, filename?: string) {
  const slides = lesson.slides || [];
  let csv =
    'Slide Number,Title,Content,Summary,Key Points\n';

  slides.forEach((slide: any, idx: number) => {
    const slideNum = idx + 1;
    const title = (slide.title || '').replace(/"/g, '""');
    const content = (slide.content || '')
      .replace(/\n/g, ' ')
      .replace(/"/g, '""');
    const summary = (slide.summary || '').replace(/"/g, '""');
    const keyPoints = (slide.keyPoints || [])
      .join('; ')
      .replace(/"/g, '""');

    csv += `${slideNum},"${title}","${content}","${summary}","${keyPoints}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${lesson.title.replace(/\s+/g, '-')}-lesson.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download lesson slides as PDF - Generates proper PDF using jsPDF
 * Works directly with localStorage data that is guaranteed to exist
 */
export async function downloadLessonAsPDF(lesson: any, filename?: string) {
  try {
    if (!lesson) {
      throw new Error('Lesson data is missing');
    }
    
    if (!lesson.title) {
      throw new Error('Lesson title is missing');
    }

    // Check if we have slides data
    if (!lesson.slides || lesson.slides.length === 0) {
      throw new Error('No slides available in this lesson');
    }

    console.log('Generating PDF for lesson:', lesson.title);
    console.log('Slides available:', lesson.slides.length);

    // Generate proper PDF using jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 20;
    const marginTop = 20;
    const marginRight = 20;
    const textWidth = pageWidth - marginLeft - marginRight;

    // Title Page
    pdf.setTextColor(102, 126, 234); // Violet color
    pdf.setFontSize(28);
    pdf.text(lesson.title, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(12);
    const createdDate = lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString() : 'Unknown';
    pdf.text(`Created: ${createdDate}`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
    pdf.text(`Total Slides: ${lesson.slides.length}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

    // Add slides
    (lesson.slides || []).forEach((slide: any, slideIndex: number) => {
      pdf.addPage();
      let yPosition = marginTop;

      // Slide title
      pdf.setTextColor(102, 126, 234);
      pdf.setFontSize(18);
      pdf.setFont('Helvetica', 'bold');
      const slideTitle = `Slide ${slideIndex + 1}: ${slide.title || 'Untitled'}`;
      const titleLines = pdf.splitTextToSize(slideTitle, textWidth);
      pdf.text(titleLines, marginLeft, yPosition);
      yPosition += titleLines.length * 8 + 10;

      // Slide content
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('Helvetica', 'normal');
      const contentLines = pdf.splitTextToSize(slide.content || 'No content', textWidth);
      pdf.text(contentLines, marginLeft, yPosition);
      yPosition += contentLines.length * 6 + 10;

      // Summary
      if (slide.summary) {
        pdf.setTextColor(102, 126, 234);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('Summary:', marginLeft, yPosition);
        yPosition += 8;

        pdf.setTextColor(0, 0, 0);
        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(9);
        const summaryLines = pdf.splitTextToSize(slide.summary, textWidth);
        pdf.text(summaryLines, marginLeft, yPosition);
        yPosition += summaryLines.length * 5 + 5;
      }

      // Key Points
      if (slide.keyPoints && Array.isArray(slide.keyPoints) && slide.keyPoints.length > 0) {
        pdf.setTextColor(102, 126, 234);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('Key Points:', marginLeft, yPosition);
        yPosition += 8;

        pdf.setTextColor(0, 0, 0);
        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(9);
        
        slide.keyPoints.forEach((point: string) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = marginTop;
          }
          const pointLines = pdf.splitTextToSize(`• ${point}`, textWidth - 5);
          pdf.text(pointLines, marginLeft + 5, yPosition);
          yPosition += pointLines.length * 5 + 2;
        });
      }
    });

    // Save PDF
    const fileName = filename || `${(lesson.title || 'lesson').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
    pdf.save(fileName);

    console.log('✅ PDF generated and downloaded successfully:', fileName);
  } catch (err) {
    console.error('PDF generation error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    alert(`Failed to generate PDF: ${errorMsg}`);
    throw err;
  }
}
