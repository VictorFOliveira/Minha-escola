import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessSchoolDocument } from "@/lib/document-access";
import { renderSchoolDocumentPdf } from "@/lib/pdf";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const { id } = await context.params;
  const document = await prisma.schoolDocument.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
    },
  });

  if (!document) {
    return new Response("Documento não encontrado.", { status: 404 });
  }

  if (!(await canAccessSchoolDocument(session, document))) {
    return new Response("Acesso negado.", { status: 403 });
  }

  const pdf = await renderSchoolDocumentPdf({
    title: document.title,
    renderedHtml: document.renderedHtml,
    verificationCode: document.verificationCode,
    issuedAt: document.issuedAt,
  });

  const safeName =
    document.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "documento";

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'inline; filename="' + safeName + ".pdf" + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
