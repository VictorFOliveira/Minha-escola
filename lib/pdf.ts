import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

function decodeEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|div|h1|h2|h3|tr|table|section|header)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const trimmed = paragraph.trim();

    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = "";

    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function addFooter(
  page: PDFPage,
  font: PDFFont,
  verificationCode: string,
) {
  page.drawText("Verificação: " + verificationCode, {
    x: 50,
    y: 25,
    size: 8,
    font,
    color: rgb(0.35, 0.4, 0.5),
  });
}

export async function renderSchoolDocumentPdf(input: {
  title: string;
  renderedHtml: string;
  verificationCode: string;
  issuedAt: Date;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title);
  pdf.setProducer("Minha Escola");
  pdf.setCreator("Minha Escola");
  pdf.setCreationDate(input.issuedAt);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 50;
  const usableWidth = pageSize[0] - margin * 2;
  const fontSize = 10.5;
  const lineHeight = 15;

  const text = htmlToText(input.renderedHtml);
  const lines = wrapText(text, font, fontSize, usableWidth);

  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  page.drawText(input.title, {
    x: margin,
    y,
    size: 15,
    font: bold,
    color: rgb(0.08, 0.14, 0.25),
  });
  y -= 28;

  for (const line of lines) {
    if (y < 55) {
      addFooter(page, font, input.verificationCode);
      page = pdf.addPage(pageSize);
      y = pageSize[1] - margin;
    }

    if (!line) {
      y -= lineHeight * 0.7;
      continue;
    }

    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0.1, 0.14, 0.22),
      maxWidth: usableWidth,
    });
    y -= lineHeight;
  }

  addFooter(page, font, input.verificationCode);

  return pdf.save();
}
