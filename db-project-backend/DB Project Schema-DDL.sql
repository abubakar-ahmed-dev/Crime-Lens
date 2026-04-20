-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "boundary" GEOMETRY(polygon, 4326),

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliceBranch" (
    "id" SERIAL NOT NULL,
    "branchHeadUserId" TEXT,
    "zoneId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactNumber" TEXT,
    "location" GEOMETRY(point, 4326) NOT NULL,

    CONSTRAINT "PoliceBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,

    CONSTRAINT "CrimeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crime" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "crimeTypeId" INTEGER NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "location" GEOMETRY(point, 4326) NOT NULL,
    "address" TEXT,
    "zoneId" INTEGER,

    CONSTRAINT "Crime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeReportsSubmitter" (
    "submitterCnic" TEXT NOT NULL,
    "submitterName" TEXT,
    "submitterContact" TEXT,

    CONSTRAINT "CrimeReportsSubmitter_pkey" PRIMARY KEY ("submitterCnic")
);

-- CreateTable
CREATE TABLE "CrimeSubmission" (
    "id" BIGSERIAL NOT NULL,
    "submitterCnic" TEXT,
    "zoneId" INTEGER,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedCrimeId" BIGINT,

    CONSTRAINT "CrimeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliceAgentRequestsTemp" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliceAgentRequestsTemp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliceAgentRequest" (
    "id" BIGSERIAL NOT NULL,
    "policeAgentRequestsTempId" BIGINT,
    "userId" TEXT,
    "branchId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliceAgentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadLog" (
    "id" SERIAL NOT NULL,
    "filename" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "totalRecords" INTEGER,
    "recordsUploaded" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PoliceBranch_zoneId_key" ON "PoliceBranch"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeType_name_key" ON "CrimeType"("name");

-- CreateIndex
CREATE INDEX "Crime_crimeTypeId_idx" ON "Crime"("crimeTypeId");

-- CreateIndex
CREATE INDEX "Crime_reportedAt_idx" ON "Crime"("reportedAt");

-- CreateIndex
CREATE INDEX "Crime_status_idx" ON "Crime"("status");

-- CreateIndex
CREATE INDEX "Crime_zoneId_reportedAt_idx" ON "Crime"("zoneId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PoliceAgentRequestsTemp_username_key" ON "PoliceAgentRequestsTemp"("username");

-- CreateIndex
CREATE INDEX "Crime_status_idx" ON "Crime"("status");


CREATE INDEX idx_crime_location ON "Crime" USING GIST(location);
CREATE INDEX idx_policebranch_location ON "PoliceBranch" USING GIST(location);
CREATE INDEX idx_zone_geom ON "Zone" USING GIST(boundary);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceBranch" ADD CONSTRAINT "PoliceBranch_branchHeadUserId_fkey" FOREIGN KEY ("branchHeadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceBranch" ADD CONSTRAINT "PoliceBranch_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crime" ADD CONSTRAINT "Crime_crimeTypeId_fkey" FOREIGN KEY ("crimeTypeId") REFERENCES "CrimeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crime" ADD CONSTRAINT "Crime_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeSubmission" ADD CONSTRAINT "CrimeSubmission_submitterCnic_fkey" FOREIGN KEY ("submitterCnic") REFERENCES "CrimeReportsSubmitter"("submitterCnic") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeSubmission" ADD CONSTRAINT "CrimeSubmission_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeSubmission" ADD CONSTRAINT "CrimeSubmission_verifiedCrimeId_fkey" FOREIGN KEY ("verifiedCrimeId") REFERENCES "Crime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceAgentRequest" ADD CONSTRAINT "PoliceAgentRequest_policeAgentRequestsTempId_fkey" FOREIGN KEY ("policeAgentRequestsTempId") REFERENCES "PoliceAgentRequestsTemp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceAgentRequest" ADD CONSTRAINT "PoliceAgentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceAgentRequest" ADD CONSTRAINT "PoliceAgentRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "PoliceBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "AgentRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "CrimeStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('completed', 'failed');

-- AlterTable
ALTER TABLE "Crime" DROP COLUMN "status",
ADD COLUMN     "status" "CrimeStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "CrimeSubmission" DROP COLUMN "status",
ADD COLUMN     "status" "CrimeStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "CrimeType" ALTER COLUMN "severity" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "PoliceAgentRequest" DROP COLUMN "status",
ADD COLUMN     "status" "AgentRequestStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "PoliceBranch" ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "contactNumber" SET NOT NULL,
ALTER COLUMN "location" SET NOT NULL;

-- AlterTable
ALTER TABLE "UploadLog" DROP COLUMN "status",
ADD COLUMN     "status" "UploadStatus" NOT NULL DEFAULT 'completed';

-- AlterTable
ALTER TABLE "Zone" DROP COLUMN "geom",
ADD COLUMN     "boundary" GEOMETRY(polygon, 4326) NOT NULL;
