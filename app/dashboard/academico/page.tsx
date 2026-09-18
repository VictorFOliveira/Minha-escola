import { ClassAcademicManager } from "@/components/class-academic-manager";
import { CurriculumManager } from "@/components/curriculum-manager";
import { SubjectPeriodManager } from "@/components/subject-period-manager";
import { requireRole } from "@/lib/session";

export default async function AcademicPage() {
  await requireRole(["ADMIN", "COORDINATOR", "SECRETARY"]);

  return (
    <div className="dashboard-content academic-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FASE 5</span>
          <h2>Estrutura acadêmica</h2>
          <p>
            Disciplinas, períodos, grades curriculares, professores por disciplina e
            quadro de horários.
          </p>
        </div>
      </div>

      <SubjectPeriodManager />
      <CurriculumManager />
      <ClassAcademicManager />
    </div>
  );
}
