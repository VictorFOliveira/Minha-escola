import { getSession } from "@/lib/session";
import { buildPersonalExport } from "@/lib/privacy";
import { auditUserAction } from "@/lib/audit";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const payload = await buildPersonalExport(session);
  const exportedAt = new Date();

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "PERSONAL_DATA_EXPORT",
    entityType: payload.subject.subjectType,
    entityId: payload.subject.subjectId,
    metadata: { exportedAt: exportedAt.toISOString() },
  }).catch(() => null);

  return new Response(
    JSON.stringify(
      {
        exportedAt,
        ...payload,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="meus-dados-minha-escola.json"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
