import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const classes = await prisma.classGroup.findMany({
    where: {
      schoolId: session.schoolId,
      ...(session.role === "TEACHER" && session.teacherId
        ? {
            classSubjects: {
              some: { teacherId: session.teacherId },
            },
          }
        : {}),
    },
    orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      schoolYear: true,
    },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "PENDING"] },
      class: {
        schoolId: session.schoolId,
        ...(session.role === "TEACHER" && session.teacherId
          ? {
              classSubjects: {
                some: { teacherId: session.teacherId },
              },
            }
          : {}),
      },
    },
    orderBy: { student: { name: "asc" } },
    select: {
      id: true,
      student: { select: { name: true, registration: true } },
      class: { select: { name: true, schoolYear: true } },
    },
  });

  const guardians = await prisma.guardian.findMany({
    where: {
      schoolId: session.schoolId,
      status: "ACTIVE",
      ...(session.role === "TEACHER" && session.teacherId
        ? {
            students: {
              some: {
                student: {
                  enrollments: {
                    some: {
                      status: { in: ["ACTIVE", "PENDING"] },
                      class: {
                        classSubjects: {
                          some: { teacherId: session.teacherId },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      students: {
        select: {
          financialResponsible: true,
          student: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    classes,
    enrollments,
    guardians,
  });
}
