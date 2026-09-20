import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { auditUserAction } from "@/lib/audit";
import {
  createCustomSchoolDomain,
  deleteCustomSchoolDomain,
  domainConfig,
  ensureDefaultSchoolDomain,
  listSchoolDomains,
  makePrimarySchoolDomain,
  verifyCustomSchoolDomain,
} from "@/lib/tenant-domain";

function errorResponse(error: any) {
  const status = Number(error?.status || 500);
  return NextResponse.json(
    { error: status >= 500 ? "Erro interno." : String(error?.message || "Erro interno.") },
    { status },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    select: { id: true, name: true, slug: true },
  });
  if (!school) return NextResponse.json({ error: "Escola não encontrada." }, { status: 404 });

  await ensureDefaultSchoolDomain(school.id, school.name, school.slug);
  const domains = await listSchoolDomains(school.id);

  return NextResponse.json({
    domains,
    config: domainConfig(),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    const domain = await createCustomSchoolDomain(
      session.schoolId,
      String(body?.domain || ""),
    );

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "SCHOOL_DOMAIN_CREATE",
      entityType: "SchoolDomain",
      entityId: domain.id,
      metadata: { domain: domain.domain },
    }).catch(() => null);

    return NextResponse.json(
      {
        domain,
        dns: {
          type: "CNAME",
          name: domain.domain,
          value: domainConfig().customCname,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    const id = String(body?.id || "");
    const action = String(body?.action || "").toLowerCase();

    if (!id || !["verify", "primary"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const result =
      action === "verify"
        ? await verifyCustomSchoolDomain(session.schoolId, id)
        : await makePrimarySchoolDomain(session.schoolId, id);

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: action === "verify" ? "SCHOOL_DOMAIN_VERIFY" : "SCHOOL_DOMAIN_PRIMARY",
      entityType: "SchoolDomain",
      entityId: id,
    }).catch(() => null);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Domínio não informado." }, { status: 400 });

    await deleteCustomSchoolDomain(session.schoolId, id);
    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "SCHOOL_DOMAIN_DELETE",
      entityType: "SchoolDomain",
      entityId: id,
    }).catch(() => null);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
