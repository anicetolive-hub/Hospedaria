-- A versão anterior podia gravar email vazio ("") em várias pessoas; o email
-- passa a ser o login e único, por isso vazios passam a NULL.
UPDATE "Person" SET "email" = NULL WHERE "email" = '';

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "weight" REAL NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "achievedAt" DATETIME,
    "parentId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Objective_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Objective" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Objective_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Objective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Kpi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "target" REAL NOT NULL,
    "warningThreshold" REAL NOT NULL DEFAULT 90,
    "weight" REAL NOT NULL DEFAULT 1,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "objectiveId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Kpi_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Kpi_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Kpi_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Kpi" ("active", "createdAt", "departmentId", "description", "direction", "frequency", "id", "name", "ownerId", "target", "unit", "updatedAt", "warningThreshold", "weight") SELECT "active", "createdAt", "departmentId", "description", "direction", "frequency", "id", "name", "ownerId", "target", "unit", "updatedAt", "warningThreshold", "weight" FROM "Kpi";
DROP TABLE "Kpi";
ALTER TABLE "new_Kpi" RENAME TO "Kpi";
CREATE INDEX "Kpi_departmentId_idx" ON "Kpi"("departmentId");
CREATE INDEX "Kpi_ownerId_idx" ON "Kpi"("ownerId");
CREATE TABLE "new_Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "jobTitle" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "departmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Person_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Person" ("active", "createdAt", "departmentId", "email", "fullName", "id", "jobTitle", "role", "updatedAt") SELECT "active", "createdAt", "departmentId", "email", "fullName", "id", "jobTitle", "role", "updatedAt" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE INDEX "Person_departmentId_idx" ON "Person"("departmentId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "objectiveId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("completedAt", "createdAt", "departmentId", "description", "dueDate", "id", "name", "ownerId", "priority", "startDate", "status", "updatedAt") SELECT "completedAt", "createdAt", "departmentId", "description", "dueDate", "id", "name", "ownerId", "priority", "startDate", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Objective_level_idx" ON "Objective"("level");

-- CreateIndex
CREATE INDEX "Objective_ownerId_idx" ON "Objective"("ownerId");

-- CreateIndex
CREATE INDEX "Objective_departmentId_idx" ON "Objective"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_personId_idx" ON "Session"("personId");
