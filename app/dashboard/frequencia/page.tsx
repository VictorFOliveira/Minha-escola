import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function AttendancePage() {
  await requireRole(["ADMIN", "COORDINATOR", "TEACHER"]);
  redirect("/dashboard/diario");
}
