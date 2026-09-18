import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessSchoolDocument } from "@/lib/document-access";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const { id } = await context.params;
  const document = await prisma.schoolDocument.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!document) {
    return new Response("Documento não encontrado.", { status: 404 });
  }

  if (!(await canAccessSchoolDocument(session, document))) {
    return new Response("Acesso negado.", { status: 403 });
  }

  return new Response(document.renderedHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    },
  });
}
