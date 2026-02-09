/*
  Warnings:

  - You are about to drop the `Climb` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Climb";

-- DropTable
DROP TABLE "public"."User";

-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "synced" BOOLEAN NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Climbs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "synced" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "route_type" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "moves" TEXT NOT NULL,
    "created_date" INTEGER NOT NULL,
    "last_updated_date" INTEGER NOT NULL,
    "link" TEXT,
    "route_location" TEXT,
    "country" TEXT,
    "area" TEXT,
    "sub_area" TEXT,
    "sent_status" BOOLEAN NOT NULL,

    CONSTRAINT "Climbs_pkey" PRIMARY KEY ("id")
);
