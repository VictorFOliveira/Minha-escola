import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const employees = await prisma.employee.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ employees });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const jobTitle = typeof body?.jobTitle === "string" ? body.jobTitle.trim() : "";

  if (!name || !jobTitle) {
    return NextResponse.json({ error: "Nome e cargo são obrigatórios." }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      schoolId: session.schoolId,
      name,
      jobTitle,
      department: body?.department?.trim() || null,
      document: body?.document?.trim() || null,
      email: body?.email?.trim()?.toLowerCase() || null,
      phone: body?.phone?.trim() || null,
      hiredAt: body?.hiredAt ? new Date(body.hiredAt) : null,
    },
  });

  return NextResponse.json({ employee }, { status: 201 });
}
