-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COORDINATOR', 'SECRETARY', 'TEACHER', 'FINANCE', 'STUDENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PENDING', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('NEW', 'REENROLLMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingBenefitType" AS ENUM ('SCHOLARSHIP', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "BillingValueType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'ASAAS', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'RECEIVED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AcademicPeriodStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('EXAM', 'QUIZ', 'ASSIGNMENT', 'PROJECT', 'PARTICIPATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('FORMATIVE', 'ACADEMIC', 'BEHAVIOR', 'SUPPORT', 'GENERAL');

-- CreateEnum
CREATE TYPE "FeedbackVisibility" AS ENUM ('INTERNAL', 'STUDENT', 'GUARDIAN', 'BOTH');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LessonAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "RecoveryCalculationMode" AS ENUM ('REPLACE_IF_HIGHER', 'AVERAGE_WITH_ANNUAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "PeriodGradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubjectResultStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'RECOVERY', 'FAILED_GRADE', 'FAILED_ATTENDANCE');

-- CreateEnum
CREATE TYPE "EnrollmentResultStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommunicationAudience" AS ENUM ('SCHOOL', 'STAFF', 'STUDENTS', 'GUARDIANS', 'FINANCIAL_GUARDIANS', 'CLASS_STUDENTS', 'CLASS_GUARDIANS', 'CLASS_BOTH', 'INDIVIDUAL_STUDENT', 'INDIVIDUAL_GUARDIAN');

-- CreateEnum
CREATE TYPE "CommunicationPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('PORTAL', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SchoolDocumentType" AS ENUM ('ENROLLMENT_DECLARATION', 'ATTENDANCE_DECLARATION', 'REPORT_CARD', 'SCHOOL_RECORD', 'PAYMENT_RECEIPT', 'ENROLLMENT_CONTRACT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SchoolDocumentStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchoolLifecycleStatus" AS ENUM ('ONBOARDING', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'PLATFORM_ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'READY', 'DELETED');

-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS_EXPORT', 'CORRECTION', 'ANONYMIZATION', 'DELETION');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PrivacySubjectType" AS ENUM ('STUDENT', 'GUARDIAN', 'USER');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_USE', 'COMMUNICATION');

-- CreateEnum
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "MalwareScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('STUDENTS', 'GUARDIANS', 'TEACHERS', 'CLASSES', 'ENROLLMENTS');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SystemJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "lifecycleStatus" "SchoolLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboardingCompletedAt" TIMESTAMP(3),
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "enrollmentId" TEXT,
    "guardianId" TEXT,
    "teacherId" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "mfaRecoveryCodeHashes" JSONB,
    "mfaEnabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "document" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "financialResponsible" BOOLEAN NOT NULL DEFAULT false,
    "authorizedPickup" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("studentId","guardianId")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "hiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "curriculumId" TEXT,
    "name" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "room" TEXT,
    "capacity" INTEGER,
    "schoolYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumSubject" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyClasses" INTEGER,
    "workloadHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubject" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "weeklyClasses" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "type" "EnrollmentType" NOT NULL DEFAULT 'NEW',
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "previousEnrollmentId" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL DEFAULT 'EXAM',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "maxScore" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentScore" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "score" DECIMAL(6,2),
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "excused" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicFeedback" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'FORMATIVE',
    "visibility" "FeedbackVisibility" NOT NULL DEFAULT 'BOTH',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "periodId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "lessonDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "plannedContent" TEXT,
    "taughtContent" TEXT,
    "homework" TEXT,
    "notes" TEXT,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAttendance" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "status" "LessonAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "passingAverage" DECIMAL(5,2) NOT NULL DEFAULT 6,
    "minimumAttendance" DECIMAL(5,2) NOT NULL DEFAULT 75,
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recoveryMode" "RecoveryCalculationMode" NOT NULL DEFAULT 'REPLACE_IF_HIGHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodGrade" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "average" DECIMAL(5,2),
    "status" "PeriodGradeStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectFinalResult" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "annualAverage" DECIMAL(5,2),
    "recoveryScore" DECIMAL(5,2),
    "finalAverage" DECIMAL(5,2),
    "attendancePercent" DECIMAL(5,2),
    "status" "SubjectResultStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectFinalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentAcademicResult" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "EnrollmentResultStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "decisionNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentAcademicResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "present" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "gatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "externalPaymentUrl" TEXT,
    "sendBillingToGuardian" BOOLEAN NOT NULL DEFAULT true,
    "sendReportToGuardian" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailProvider" TEXT,
    "whatsappProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "systemKey" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "CommunicationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "CommunicationAudience" NOT NULL,
    "targetClassId" TEXT,
    "targetEnrollmentId" TEXT,
    "targetGuardianId" TEXT,
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "userId" TEXT,
    "guardianId" TEXT,
    "enrollmentId" TEXT,
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "fileAssetId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDelivery" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "destination" TEXT,
    "providerId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationRequest" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "SchoolDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "SchoolDocumentType" NOT NULL,
    "status" "SchoolDocumentStatus" NOT NULL DEFAULT 'ISSUED',
    "title" TEXT NOT NULL,
    "studentId" TEXT,
    "enrollmentId" TEXT,
    "guardianId" TEXT,
    "chargeId" TEXT,
    "issuedByUserId" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "renderedHtml" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "mfaRecoveryCodeHashes" JSONB,
    "mfaEnabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaaSPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(12,2) NOT NULL,
    "annualPrice" DECIMAL(12,2),
    "maxStudents" INTEGER,
    "maxUsers" INTEGER,
    "features" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaaSPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSubscription" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "externalId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "nextBillingAt" TIMESTAMP(3),
    "externalCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "platformAdminId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
    "sha256" TEXT,
    "scanStatus" "MalwareScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanProvider" TEXT,
    "scanResult" TEXT,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacySettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicRetentionYears" INTEGER NOT NULL DEFAULT 10,
    "financialRetentionYears" INTEGER NOT NULL DEFAULT 5,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "allowPortalRequests" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataPrivacyRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "processedByUserId" TEXT,
    "type" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'OPEN',
    "subjectType" "PrivacySubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "DataPrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ConsentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'ASAAS',
    "externalId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityThrottle" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "impersonatedByPlatformAdminId" TEXT,
    "supportReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSession" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "platformAdminId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'INFO',
    "requestId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingWebhook" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutgoingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "responseCode" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutgoingWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "resourceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "sourceName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemJobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "SystemJobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schoolYear" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(12,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 12,
    "dueDay" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingContract" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "guardianId" TEXT,
    "billingPlanId" TEXT,
    "installmentAmount" DECIMAL(12,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 12,
    "dueDay" INTEGER NOT NULL,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "status" "BillingContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingBenefit" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BillingBenefitType" NOT NULL DEFAULT 'DISCOUNT',
    "valueType" "BillingValueType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCustomer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "guardianId" TEXT,
    "contractId" TEXT,
    "installmentNumber" INTEGER,
    "description" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interestAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "paymentMethod" "PaymentMethod",
    "externalId" TEXT,
    "externalStatus" TEXT,
    "invoiceUrl" TEXT,
    "bankSlipUrl" TEXT,
    "pixCopyPaste" TEXT,
    "pixQrCodeBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECEIVED',
    "externalId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "School_document_key" ON "School"("document");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_enrollmentId_key" ON "User"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_guardianId_key" ON "User"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "User_teacherId_key" ON "User"("teacherId");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE INDEX "User_schoolId_role_active_idx" ON "User"("schoolId", "role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Student_schoolId_name_idx" ON "Student"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_registration_key" ON "Student"("schoolId", "registration");

-- CreateIndex
CREATE INDEX "Guardian_schoolId_name_idx" ON "Guardian"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Guardian_schoolId_status_idx" ON "Guardian"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_name_idx" ON "Teacher"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_status_idx" ON "Teacher"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Employee_schoolId_name_idx" ON "Employee"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Employee_schoolId_status_idx" ON "Employee"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ClassGroup_schoolId_schoolYear_idx" ON "ClassGroup"("schoolId", "schoolYear");

-- CreateIndex
CREATE INDEX "ClassGroup_schoolId_schoolYear_gradeLevel_name_idx" ON "ClassGroup"("schoolId", "schoolYear", "gradeLevel", "name");

-- CreateIndex
CREATE INDEX "ClassGroup_teacherId_idx" ON "ClassGroup"("teacherId");

-- CreateIndex
CREATE INDEX "ClassGroup_curriculumId_idx" ON "ClassGroup"("curriculumId");

-- CreateIndex
CREATE INDEX "Subject_schoolId_active_idx" ON "Subject"("schoolId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Curriculum_schoolId_schoolYear_active_idx" ON "Curriculum"("schoolId", "schoolYear", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_schoolId_gradeLevel_schoolYear_key" ON "Curriculum"("schoolId", "gradeLevel", "schoolYear");

-- CreateIndex
CREATE INDEX "CurriculumSubject_subjectId_idx" ON "CurriculumSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumSubject_curriculumId_subjectId_key" ON "CurriculumSubject"("curriculumId", "subjectId");

-- CreateIndex
CREATE INDEX "ClassSubject_subjectId_idx" ON "ClassSubject"("subjectId");

-- CreateIndex
CREATE INDEX "ClassSubject_teacherId_idx" ON "ClassSubject"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_key" ON "ClassSubject"("classId", "subjectId");

-- CreateIndex
CREATE INDEX "ClassScheduleSlot_classSubjectId_weekday_idx" ON "ClassScheduleSlot"("classSubjectId", "weekday");

-- CreateIndex
CREATE INDEX "AcademicPeriod_schoolId_schoolYear_status_idx" ON "AcademicPeriod"("schoolId", "schoolYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPeriod_schoolId_schoolYear_order_key" ON "AcademicPeriod"("schoolId", "schoolYear", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_previousEnrollmentId_key" ON "Enrollment"("previousEnrollmentId");

-- CreateIndex
CREATE INDEX "Enrollment_classId_status_idx" ON "Enrollment"("classId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_status_idx" ON "Enrollment"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_classId_key" ON "Enrollment"("studentId", "classId");

-- CreateIndex
CREATE INDEX "Assessment_classSubjectId_periodId_status_idx" ON "Assessment"("classSubjectId", "periodId", "status");

-- CreateIndex
CREATE INDEX "AssessmentScore_enrollmentId_idx" ON "AssessmentScore"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentScore_assessmentId_enrollmentId_key" ON "AssessmentScore"("assessmentId", "enrollmentId");

-- CreateIndex
CREATE INDEX "AcademicFeedback_schoolId_enrollmentId_visibility_idx" ON "AcademicFeedback"("schoolId", "enrollmentId", "visibility");

-- CreateIndex
CREATE INDEX "AcademicFeedback_authorUserId_idx" ON "AcademicFeedback"("authorUserId");

-- CreateIndex
CREATE INDEX "Lesson_classSubjectId_lessonDate_status_idx" ON "Lesson"("classSubjectId", "lessonDate", "status");

-- CreateIndex
CREATE INDEX "Lesson_periodId_idx" ON "Lesson"("periodId");

-- CreateIndex
CREATE INDEX "Lesson_createdByUserId_idx" ON "Lesson"("createdByUserId");

-- CreateIndex
CREATE INDEX "LessonAttendance_enrollmentId_idx" ON "LessonAttendance"("enrollmentId");

-- CreateIndex
CREATE INDEX "LessonAttendance_recordedByUserId_idx" ON "LessonAttendance"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonAttendance_lessonId_enrollmentId_key" ON "LessonAttendance"("lessonId", "enrollmentId");

-- CreateIndex
CREATE INDEX "AcademicPolicy_schoolId_schoolYear_idx" ON "AcademicPolicy"("schoolId", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPolicy_schoolId_schoolYear_key" ON "AcademicPolicy"("schoolId", "schoolYear");

-- CreateIndex
CREATE INDEX "PeriodGrade_classSubjectId_periodId_status_idx" ON "PeriodGrade"("classSubjectId", "periodId", "status");

-- CreateIndex
CREATE INDEX "PeriodGrade_closedByUserId_idx" ON "PeriodGrade"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodGrade_enrollmentId_classSubjectId_periodId_key" ON "PeriodGrade"("enrollmentId", "classSubjectId", "periodId");

-- CreateIndex
CREATE INDEX "SubjectFinalResult_classSubjectId_status_idx" ON "SubjectFinalResult"("classSubjectId", "status");

-- CreateIndex
CREATE INDEX "SubjectFinalResult_closedByUserId_idx" ON "SubjectFinalResult"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectFinalResult_enrollmentId_classSubjectId_key" ON "SubjectFinalResult"("enrollmentId", "classSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentAcademicResult_enrollmentId_key" ON "EnrollmentAcademicResult"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentAcademicResult_status_idx" ON "EnrollmentAcademicResult"("status");

-- CreateIndex
CREATE INDEX "EnrollmentAcademicResult_closedByUserId_idx" ON "EnrollmentAcademicResult"("closedByUserId");

-- CreateIndex
CREATE INDEX "Attendance_classId_date_idx" ON "Attendance"("classId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_classId_date_key" ON "Attendance"("studentId", "classId", "date");

-- CreateIndex
CREATE INDEX "Grade_studentId_classId_idx" ON "Grade"("studentId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSettings_schoolId_key" ON "FinanceSettings"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationSettings_schoolId_key" ON "CommunicationSettings"("schoolId");

-- CreateIndex
CREATE INDEX "Communication_schoolId_status_publishAt_idx" ON "Communication"("schoolId", "status", "publishAt");

-- CreateIndex
CREATE INDEX "Communication_targetClassId_idx" ON "Communication"("targetClassId");

-- CreateIndex
CREATE INDEX "Communication_targetEnrollmentId_idx" ON "Communication"("targetEnrollmentId");

-- CreateIndex
CREATE INDEX "Communication_targetGuardianId_idx" ON "Communication"("targetGuardianId");

-- CreateIndex
CREATE UNIQUE INDEX "Communication_schoolId_systemKey_key" ON "Communication"("schoolId", "systemKey");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_userId_readAt_idx" ON "CommunicationRecipient"("userId", "readAt");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_guardianId_readAt_idx" ON "CommunicationRecipient"("guardianId", "readAt");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_enrollmentId_readAt_idx" ON "CommunicationRecipient"("enrollmentId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationRecipient_communicationId_recipientKey_key" ON "CommunicationRecipient"("communicationId", "recipientKey");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_schoolId_communicationId_idx" ON "CommunicationAttachment"("schoolId", "communicationId");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_fileAssetId_idx" ON "CommunicationAttachment"("fileAssetId");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_channel_status_idx" ON "CommunicationDelivery"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationDelivery_recipientId_channel_key" ON "CommunicationDelivery"("recipientId", "channel");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_guardianId_status_idx" ON "AuthorizationRequest"("guardianId", "status");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_studentId_status_idx" ON "AuthorizationRequest"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationRequest_communicationId_studentId_guardianId_key" ON "AuthorizationRequest"("communicationId", "studentId", "guardianId");

-- CreateIndex
CREATE INDEX "DocumentTemplate_schoolId_type_active_idx" ON "DocumentTemplate"("schoolId", "type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_schoolId_type_name_key" ON "DocumentTemplate"("schoolId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolDocument_verificationCode_key" ON "SchoolDocument"("verificationCode");

-- CreateIndex
CREATE INDEX "SchoolDocument_schoolId_type_issuedAt_idx" ON "SchoolDocument"("schoolId", "type", "issuedAt");

-- CreateIndex
CREATE INDEX "SchoolDocument_studentId_issuedAt_idx" ON "SchoolDocument"("studentId", "issuedAt");

-- CreateIndex
CREATE INDEX "SchoolDocument_enrollmentId_issuedAt_idx" ON "SchoolDocument"("enrollmentId", "issuedAt");

-- CreateIndex
CREATE INDEX "SchoolDocument_guardianId_issuedAt_idx" ON "SchoolDocument"("guardianId", "issuedAt");

-- CreateIndex
CREATE INDEX "SchoolDocument_chargeId_idx" ON "SchoolDocument"("chargeId");

-- CreateIndex
CREATE INDEX "SchoolDocument_issuedByUserId_idx" ON "SchoolDocument"("issuedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SaaSPlan_code_key" ON "SaaSPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscription_schoolId_key" ON "SchoolSubscription"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolSubscription_planId_status_idx" ON "SchoolSubscription"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscription_provider_externalId_key" ON "SchoolSubscription"("provider", "externalId");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_platformAdminId_createdAt_idx" ON "AuditLog"("platformAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_objectKey_key" ON "FileAsset"("objectKey");

-- CreateIndex
CREATE INDEX "FileAsset_schoolId_status_createdAt_idx" ON "FileAsset"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_createdByUserId_idx" ON "FileAsset"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacySettings_schoolId_key" ON "PrivacySettings"("schoolId");

-- CreateIndex
CREATE INDEX "DataPrivacyRequest_schoolId_status_createdAt_idx" ON "DataPrivacyRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DataPrivacyRequest_subjectType_subjectId_idx" ON "DataPrivacyRequest"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "DataPrivacyRequest_requestedByUserId_idx" ON "DataPrivacyRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_kind_revokedAt_idx" ON "ConsentRecord"("userId", "kind", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_kind_version_key" ON "ConsentRecord"("userId", "kind", "version");

-- CreateIndex
CREATE INDEX "PlatformInvoice_status_dueDate_idx" ON "PlatformInvoice"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_provider_externalId_key" ON "PlatformInvoice"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_subscriptionId_periodStart_key" ON "PlatformInvoice"("subscriptionId", "periodStart");

-- CreateIndex
CREATE INDEX "PlatformWebhookEvent_provider_eventType_createdAt_idx" ON "PlatformWebhookEvent"("provider", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformWebhookEvent_provider_eventId_key" ON "PlatformWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "SecurityThrottle_blockedUntil_idx" ON "SecurityThrottle"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityThrottle_action_keyHash_key" ON "SecurityThrottle"("action", "keyHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_expiresAt_idx" ON "UserSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_impersonatedByPlatformAdminId_idx" ON "UserSession"("impersonatedByPlatformAdminId");

-- CreateIndex
CREATE INDEX "PlatformSession_platformAdminId_revokedAt_expiresAt_idx" ON "PlatformSession"("platformAdminId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_schoolId_createdAt_idx" ON "SecurityEvent"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_platformAdminId_createdAt_idx" ON "SecurityEvent"("platformAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_severity_createdAt_idx" ON "SecurityEvent"("eventType", "severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_secretHash_key" ON "ApiCredential"("secretHash");

-- CreateIndex
CREATE INDEX "ApiCredential_schoolId_active_idx" ON "ApiCredential"("schoolId", "active");

-- CreateIndex
CREATE INDEX "ApiCredential_keyPrefix_idx" ON "ApiCredential"("keyPrefix");

-- CreateIndex
CREATE INDEX "OutgoingWebhook_schoolId_active_idx" ON "OutgoingWebhook"("schoolId", "active");

-- CreateIndex
CREATE INDEX "OutgoingWebhookDelivery_status_nextAttemptAt_idx" ON "OutgoingWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutgoingWebhookDelivery_webhookId_eventId_key" ON "OutgoingWebhookDelivery"("webhookId", "eventId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_schoolId_operation_keyHash_key" ON "IdempotencyRecord"("schoolId", "operation", "keyHash");

-- CreateIndex
CREATE INDEX "ImportJob_schoolId_status_createdAt_idx" ON "ImportJob"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemJobRun_jobName_startedAt_idx" ON "SystemJobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "SystemJobRun_status_startedAt_idx" ON "SystemJobRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "BillingPlan_schoolId_schoolYear_active_idx" ON "BillingPlan"("schoolId", "schoolYear", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_schoolId_schoolYear_name_key" ON "BillingPlan"("schoolId", "schoolYear", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BillingContract_enrollmentId_key" ON "BillingContract"("enrollmentId");

-- CreateIndex
CREATE INDEX "BillingContract_schoolId_status_idx" ON "BillingContract"("schoolId", "status");

-- CreateIndex
CREATE INDEX "BillingContract_guardianId_idx" ON "BillingContract"("guardianId");

-- CreateIndex
CREATE INDEX "BillingContract_billingPlanId_idx" ON "BillingContract"("billingPlanId");

-- CreateIndex
CREATE INDEX "BillingBenefit_contractId_active_idx" ON "BillingBenefit"("contractId", "active");

-- CreateIndex
CREATE INDEX "PaymentCustomer_schoolId_provider_idx" ON "PaymentCustomer"("schoolId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCustomer_guardianId_provider_key" ON "PaymentCustomer"("guardianId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCustomer_provider_externalId_key" ON "PaymentCustomer"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Charge_schoolId_status_dueDate_idx" ON "Charge"("schoolId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Charge_schoolId_dueDate_createdAt_idx" ON "Charge"("schoolId", "dueDate", "createdAt");

-- CreateIndex
CREATE INDEX "Charge_studentId_dueDate_idx" ON "Charge"("studentId", "dueDate");

-- CreateIndex
CREATE INDEX "Charge_guardianId_status_idx" ON "Charge"("guardianId", "status");

-- CreateIndex
CREATE INDEX "Charge_enrollmentId_idx" ON "Charge"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_contractId_installmentNumber_key" ON "Charge"("contractId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_provider_externalId_key" ON "Charge"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Payment_chargeId_paidAt_idx" ON "Payment"("chargeId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_recordedByUserId_idx" ON "Payment"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_externalId_key" ON "Payment"("provider", "externalId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_provider_eventType_createdAt_idx" ON "PaymentWebhookEvent"("provider", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPeriod" ADD CONSTRAINT "AcademicPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_previousEnrollmentId_fkey" FOREIGN KEY ("previousEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicFeedback" ADD CONSTRAINT "AcademicFeedback_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicFeedback" ADD CONSTRAINT "AcademicFeedback_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicFeedback" ADD CONSTRAINT "AcademicFeedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPolicy" ADD CONSTRAINT "AcademicPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodGrade" ADD CONSTRAINT "PeriodGrade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodGrade" ADD CONSTRAINT "PeriodGrade_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodGrade" ADD CONSTRAINT "PeriodGrade_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodGrade" ADD CONSTRAINT "PeriodGrade_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectFinalResult" ADD CONSTRAINT "SubjectFinalResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectFinalResult" ADD CONSTRAINT "SubjectFinalResult_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectFinalResult" ADD CONSTRAINT "SubjectFinalResult_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentAcademicResult" ADD CONSTRAINT "EnrollmentAcademicResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentAcademicResult" ADD CONSTRAINT "EnrollmentAcademicResult_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettings" ADD CONSTRAINT "FinanceSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationSettings" ADD CONSTRAINT "CommunicationSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_targetEnrollmentId_fkey" FOREIGN KEY ("targetEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "CommunicationRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SaaSPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacySettings" ADD CONSTRAINT "PrivacySettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SchoolSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_impersonatedByPlatformAdminId_fkey" FOREIGN KEY ("impersonatedByPlatformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingWebhook" ADD CONSTRAINT "OutgoingWebhook_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingWebhook" ADD CONSTRAINT "OutgoingWebhook_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingWebhookDelivery" ADD CONSTRAINT "OutgoingWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "OutgoingWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContract" ADD CONSTRAINT "BillingContract_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContract" ADD CONSTRAINT "BillingContract_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContract" ADD CONSTRAINT "BillingContract_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContract" ADD CONSTRAINT "BillingContract_billingPlanId_fkey" FOREIGN KEY ("billingPlanId") REFERENCES "BillingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingBenefit" ADD CONSTRAINT "BillingBenefit_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "BillingContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCustomer" ADD CONSTRAINT "PaymentCustomer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCustomer" ADD CONSTRAINT "PaymentCustomer_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "BillingContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

