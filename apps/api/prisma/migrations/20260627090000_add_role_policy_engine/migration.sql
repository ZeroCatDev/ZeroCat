-- CreateTable
CREATE TABLE "ow_roles" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "scope" VARCHAR(160) NOT NULL,
    "effect" VARCHAR(16) NOT NULL DEFAULT 'allow',
    "conditions" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "reason" VARCHAR(255),
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ow_roles_key_key" ON "ow_roles"("key");

-- CreateIndex
CREATE INDEX "ow_roles_system_idx" ON "ow_roles"("system");

-- CreateIndex
CREATE INDEX "ow_roles_priority_idx" ON "ow_roles"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ow_role_permissions_role_id_scope_effect_key" ON "ow_role_permissions"("role_id", "scope", "effect");

-- CreateIndex
CREATE INDEX "ow_role_permissions_scope_idx" ON "ow_role_permissions"("scope");

-- CreateIndex
CREATE INDEX "ow_role_permissions_effect_idx" ON "ow_role_permissions"("effect");

-- CreateIndex
CREATE UNIQUE INDEX "ow_user_roles_user_id_role_id_key" ON "ow_user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "ow_user_roles_user_id_idx" ON "ow_user_roles"("user_id");

-- CreateIndex
CREATE INDEX "ow_user_roles_role_id_idx" ON "ow_user_roles"("role_id");

-- CreateIndex
CREATE INDEX "ow_user_roles_assigned_by_idx" ON "ow_user_roles"("assigned_by");

-- CreateIndex
CREATE INDEX "ow_user_roles_expires_at_idx" ON "ow_user_roles"("expires_at");
