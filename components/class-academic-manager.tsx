"use client";

import { useEffect, useMemo, useState } from "react";

type Teacher = {
  id: string;
  name: string;
};

type Curriculum = {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: number;
  active: boolean;
};

type ClassItem = {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYear: number;
  shift: string;
  room: string | null;
  curriculum?: Curriculum | null;
};

type ScheduleSlot = {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
};

type ClassSubject = {
  id: string;
  weeklyClasses: number | null;
  subject: { id: string; name: string; code: string | null };
  teacher: Teacher | null;
  scheduleSlots: ScheduleSlot[];
};

type ClassDetail = ClassItem & {
  curriculum: Curriculum | null;
  classSubjects: ClassSubject[];
};

const weekdayLabels: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

export function ClassAcademicManager() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [scheduleSubject, setScheduleSubject] = useState<ClassSubject | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadBase() {
    setLoading(true);
    setError("");

    try {
      const [classResponse, curriculumResponse, teacherResponse] = await Promise.all([
        fetch("/api/classes", { cache: "no-store" }),
        fetch("/api/curricula", { cache: "no-store" }),
        fetch("/api/teachers", { cache: "no-store" }),
      ]);
      const [classData, curriculumData, teacherData] = await Promise.all([
        classResponse.json(),
        curriculumResponse.json(),
        teacherResponse.json(),
      ]);

      if (!classResponse.ok) {
        setError(classData.error || "Não foi possível carregar as turmas.");
        return;
      }

      setClasses(classData.classes || []);
      if (curriculumResponse.ok) setCurricula(curriculumData.curricula || []);
      if (teacherResponse.ok) {
        setTeachers(
          (teacherData.teachers || [])
            .filter((teacher: any) => teacher.status === "ACTIVE")
            .map((teacher: any) => ({ id: teacher.id, name: teacher.name })),
        );
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClass(classId: string) {
    if (!classId) {
      setDetail(null);
      return;
    }

    setError("");

    const response = await fetch("/api/classes/" + classId + "/subjects", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível carregar a estrutura da turma.");
      return;
    }

    setDetail(data.class);
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    void loadClass(selectedClassId);
  }, [selectedClassId]);

  const compatibleCurricula = useMemo(() => {
    if (!detail) return [];

    return curricula.filter(
      (item) =>
        item.active &&
        item.schoolYear === detail.schoolYear &&
        item.gradeLevel.trim().toLowerCase() ===
          detail.gradeLevel.trim().toLowerCase(),
    );
  }, [curricula, detail]);

  async function applyCurriculum(curriculumId: string) {
    if (!detail || !curriculumId) return;

    setError("");
    setMessage("");

    const response = await fetch(
      "/api/classes/" + detail.id + "/curriculum",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumId }),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível aplicar a grade.");
      return;
    }

    setDetail(data.class);
    setMessage("Grade curricular aplicada à turma.");
    await loadBase();
  }

  async function updateClassSubject(
    item: ClassSubject,
    changes: { teacherId?: string; weeklyClasses?: string },
  ) {
    setError("");
    setMessage("");

    const response = await fetch("/api/class-subjects/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível atualizar a disciplina.");
      return;
    }

    await loadClass(selectedClassId);
    setMessage("Disciplina da turma atualizada.");
  }

  function openSchedule(item: ClassSubject) {
    setScheduleSubject(item);
    setSlots(
      item.scheduleSlots.map((slot) => ({
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
      })),
    );
  }

  function addSlot() {
    setSlots((current) => [
      ...current,
      {
        weekday: 1,
        startTime: "08:00",
        endTime: "08:50",
        room: detail?.room || null,
      },
    ]);
  }

  function updateSlot(index: number, changes: Partial<ScheduleSlot>) {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...changes } : slot,
      ),
    );
  }

  function removeSlot(index: number) {
    setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  }

  async function saveSchedule() {
    if (!scheduleSubject) return;

    setError("");
    setMessage("");

    const response = await fetch(
      "/api/class-subjects/" + scheduleSubject.id + "/schedule",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível salvar o quadro de horários.");
      return;
    }

    setScheduleSubject(null);
    setSlots([]);
    await loadClass(selectedClassId);
    setMessage("Quadro de horários atualizado.");
  }

  return (
    <section className="panel class-academic-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TURMAS E GRADE</span>
          <h2>Aplicação acadêmica por turma</h2>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      {loading ? (
        <div className="loading-state">Carregando estrutura acadêmica...</div>
      ) : (
        <>
          <div className="academic-class-selector">
            <label>
              Turma
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
              >
                <option value="">Selecione uma turma...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.schoolYear} • {item.name} • {item.gradeLevel}
                  </option>
                ))}
              </select>
            </label>

            {detail ? (
              <label>
                Grade curricular
                <select
                  value={detail.curriculum?.id || ""}
                  onChange={(event) => void applyCurriculum(event.target.value)}
                >
                  <option value="">Selecione uma grade compatível...</option>
                  {compatibleCurricula.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {detail ? (
            <div className="class-academic-summary">
              <div>
                <strong>{detail.name}</strong>
                <span>{detail.gradeLevel} • {detail.schoolYear} • {detail.shift}</span>
              </div>
              <div>
                <small>Grade aplicada</small>
                <strong>{detail.curriculum?.name || "Nenhuma"}</strong>
              </div>
            </div>
          ) : null}

          {detail && !detail.curriculum ? (
            <div className="empty-records academic-empty-small">
              <span>▦</span>
              <h3>A turma ainda não possui grade curricular</h3>
              <p>Crie uma grade compatível e selecione-a acima.</p>
            </div>
          ) : null}

          {detail?.classSubjects?.length ? (
            <div className="class-subject-list">
              {detail.classSubjects.map((item) => (
                <article className="class-subject-row" key={item.id}>
                  <div className="class-subject-name">
                    <strong>{item.subject.name}</strong>
                    <span>{item.subject.code || "Sem código"}</span>
                  </div>

                  <label>
                    Professor
                    <select
                      value={item.teacher?.id || ""}
                      onChange={(event) =>
                        void updateClassSubject(item, {
                          teacherId: event.target.value,
                        })
                      }
                    >
                      <option value="">Não definido</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Aulas/semana
                    <input
                      type="number"
                      min="1"
                      defaultValue={item.weeklyClasses || ""}
                      onBlur={(event) =>
                        void updateClassSubject(item, {
                          weeklyClasses: event.target.value,
                        })
                      }
                    />
                  </label>

                  <div className="subject-schedule-summary">
                    <small>Horários</small>
                    <strong>{item.scheduleSlots.length}</strong>
                    <span>
                      {item.scheduleSlots.length
                        ? item.scheduleSlots
                            .slice(0, 2)
                            .map(
                              (slot) =>
                                weekdayLabels[slot.weekday] +
                                " " +
                                slot.startTime,
                            )
                            .join(" • ")
                        : "Não definidos"}
                    </span>
                  </div>

                  <button
                    className="button button--secondary button--small"
                    type="button"
                    onClick={() => openSchedule(item)}
                  >
                    Quadro de horários
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </>
      )}

      {scheduleSubject ? (
        <div className="schedule-editor">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">HORÁRIOS</span>
              <h2>{scheduleSubject.subject.name}</h2>
            </div>
            <button
              className="more-button"
              type="button"
              onClick={() => setScheduleSubject(null)}
            >
              ✕
            </button>
          </div>

          <div className="schedule-slot-list">
            {slots.map((slot, index) => (
              <div className="schedule-slot-row" key={index}>
                <select
                  value={slot.weekday}
                  onChange={(event) =>
                    updateSlot(index, { weekday: Number(event.target.value) })
                  }
                >
                  {Object.entries(weekdayLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(event) =>
                    updateSlot(index, { startTime: event.target.value })
                  }
                />
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(event) =>
                    updateSlot(index, { endTime: event.target.value })
                  }
                />
                <input
                  value={slot.room || ""}
                  placeholder="Sala"
                  onChange={(event) =>
                    updateSlot(index, { room: event.target.value || null })
                  }
                />
                <button
                  className="inline-action inline-action--danger"
                  type="button"
                  onClick={() => removeSlot(index)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="schedule-actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={addSlot}
            >
              + Horário
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => void saveSchedule()}
            >
              Salvar quadro
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
