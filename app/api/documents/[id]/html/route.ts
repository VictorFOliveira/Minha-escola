import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

  let allowed = ["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role);

  if (session.role === "FINANCE" && document.type === "PAYMENT_RECEIPT") {
    allowed = true;
  }

  if (session.role === "STUDENT" && session.enrollmentId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: session.enrollmentId },
      select: { studentId: true },
    });

    allowed =
      Boolean(enrollment) &&
      (document.enrollmentId === session.enrollmentId ||
        document.studentId === enrollment?.studentId);
  }

  if (session.role === "GUARDIAN" && session.guardianId) {
    if (document.guardianId === session.guardianId) {
      allowed = true;
    } else if (document.studentId) {
      const link = await prisma.studentGuardian.findUnique({
        where: {
          studentId_guardianId: {
            studentId: document.studentId,
            guardianId: session.guardianId,
          },
        },
      });
      allowed = Boolean(link);
    }
  }

  if (!allowed) {
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
