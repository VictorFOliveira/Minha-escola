CREATE TABLE "SchoolDomain" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolDomain_domain_key" ON "SchoolDomain"("domain");
CREATE INDEX "SchoolDomain_schoolId_type_verified_idx" ON "SchoolDomain"("schoolId","type","verified");
CREATE INDEX "SchoolDomain_schoolId_isPrimary_idx" ON "SchoolDomain"("schoolId","isPrimary");
CREATE UNIQUE INDEX "SchoolDomain_one_primary_per_school_idx" ON "SchoolDomain"("schoolId") WHERE "isPrimary" = true;

ALTER TABLE "SchoolDomain"
  ADD CONSTRAINT "SchoolDomain_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
