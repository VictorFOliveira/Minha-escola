import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessEnrollmentAcademic } from "@/lib/academic-access";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const enrollmentId = url.searchParams.get("enrollmentId") || "";

  const enrollment = await canAccessEnrollmentAcademic(session, enrollmentId);
  if (!enrollment) {
    return NextResponse.json({ error: "Matrícula não encontrada ou sem acesso." }, { status: 404 });
  }

  let visibility: Array<"INTERNAL" | "STUDENT" | "GUARDIAN" | "BOTH"> = ["INTERNAL", "STUDENT", "GUARDIAN", "BOTH"];

  if (session.role === "STUDENT") visibility = ["STUDENT", "BOTH"];
  if (session.role === "GUARDIAN") visibility = ["GUARDIAN", "BOTH"];

  const feedbacks = await prisma.academicFeedback.findMany({
    where: {
      enrollmentId,
      schoolId: session.schoolId,
      visibility: { in: visibility },
      ...(session.role === "STUDENT" || session.role === "GUARDIAN"
        ? { publishedAt: { not: null } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  return NextResponse.json({ feedbacks });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const enrollmentId = typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
  const enrollment = await canAccessEnrollmentAcademic(session, enrollmentId);

  if (!enrollment) {
    return NextResponse.json({ error: "Matrícula não encontrada ou sem acesso." }, { status: 404 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const category = ["FORMATIVE", "ACADEMIC", "BEHAVIOR", "SUPPORT", "GENERAL"].includes(body?.category)
    ? body.category
    : "FORMATIVE";
  const visibility = ["INTERNAL", "STUDENT", "GUARDIAN", "BOTH"].includes(body?.visibility)
    ? body.visibility
    : "BOTH";

  if (!title || !content) {
    return NextResponse.json({ error: "Título e conteúdo são obrigatórios." }, { status: 400 });
  }

  const feedback = await prisma.academicFeedback.create({
    data: {
      schoolId: session.schoolId,
      enrollmentId,
      authorUserId: session.id,
      title,
      content,
      category,
      visibility,
      publishedAt: body?.publish === false ? null : new Date(),
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
