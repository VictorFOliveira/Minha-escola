export type AssessmentForAverage = {
  maxScore: number;
  weight: number;
  score: number | null;
  absent: boolean;
  excused: boolean;
};

export type WeightedPeriod = {
  average: number;
  weight: number;
};

export type RecoveryMode =
  | "REPLACE_IF_HIGHER"
  | "AVERAGE_WITH_ANNUAL"
  | "MANUAL";

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculatePeriodAverage(
  assessments: AssessmentForAverage[],
) {
  if (!assessments.length) {
    return {
      average: null as number | null,
      complete: false,
      missing: 0,
      considered: 0,
    };
  }

  let weightedTotal = 0;
  let weightTotal = 0;
  let missing = 0;
  let considered = 0;

  for (const assessment of assessments) {
    if (!(assessment.maxScore > 0) || !(assessment.weight > 0)) {
      missing += 1;
      continue;
    }

    if (assessment.excused) {
      continue;
    }

    let normalized: number | null = null;

    if (assessment.score !== null) {
      normalized = (assessment.score / assessment.maxScore) * 10;
    } else if (assessment.absent) {
      normalized = 0;
    } else {
      missing += 1;
      continue;
    }

    weightedTotal += normalized * assessment.weight;
    weightTotal += assessment.weight;
    considered += 1;
  }

  if (missing > 0 || weightTotal === 0) {
    return {
      average: null as number | null,
      complete: false,
      missing,
      considered,
    };
  }

  return {
    average: round2(weightedTotal / weightTotal),
    complete: true,
    missing: 0,
    considered,
  };
}

export function calculateAnnualAverage(periods: WeightedPeriod[]) {
  const valid = periods.filter(
    (period) => period.weight > 0 && Number.isFinite(period.average),
  );

  if (!valid.length) return null;

  const weightTotal = valid.reduce((sum, period) => sum + period.weight, 0);
  if (!(weightTotal > 0)) return null;

  return round2(
    valid.reduce(
      (sum, period) => sum + period.average * period.weight,
      0,
    ) / weightTotal,
  );
}

export function calculateAttendancePercent(input: {
  present: number;
  late: number;
  absent: number;
  excused: number;
}) {
  const total =
    input.present + input.late + input.absent + input.excused;

  if (!total) return null;

  return round2(((input.present + input.late) / total) * 100);
}

export function calculateRecoveryFinal(input: {
  annualAverage: number;
  recoveryScore: number | null;
  recoveryMode: RecoveryMode;
  manualFinalAverage?: number | null;
}) {
  const { annualAverage, recoveryScore, recoveryMode } = input;

  if (recoveryScore === null) return round2(annualAverage);

  if (recoveryMode === "REPLACE_IF_HIGHER") {
    return round2(Math.max(annualAverage, recoveryScore));
  }

  if (recoveryMode === "AVERAGE_WITH_ANNUAL") {
    return round2((annualAverage + recoveryScore) / 2);
  }

  if (input.manualFinalAverage === null || input.manualFinalAverage === undefined) {
    return null;
  }

  return round2(input.manualFinalAverage);
}

export function determineSubjectStatus(input: {
  finalAverage: number | null;
  annualAverage: number | null;
  attendancePercent: number | null;
  passingAverage: number;
  minimumAttendance: number;
  recoveryEnabled: boolean;
  hasRecoveryScore?: boolean;
}) {
  const {
    finalAverage,
    annualAverage,
    attendancePercent,
    passingAverage,
    minimumAttendance,
    recoveryEnabled,
    hasRecoveryScore = false,
  } = input;

  if (annualAverage === null || attendancePercent === null) {
    return "IN_PROGRESS" as const;
  }

  if (attendancePercent < minimumAttendance) {
    return "FAILED_ATTENDANCE" as const;
  }

  if (finalAverage !== null && finalAverage >= passingAverage) {
    return "APPROVED" as const;
  }

  if (recoveryEnabled && !hasRecoveryScore) {
    return "RECOVERY" as const;
  }

  return "FAILED_GRADE" as const;
}
