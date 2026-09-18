import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { executePrivacyRequest } from "@/lib/privacy";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const request = await executePrivacyRequest({
      requestId: id,
      schoolId: session.schoolId,
      adminUserId: session.id,
    });

    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível executar a solicitação.",
      },
      { status: 409 },
    );
  }
}
