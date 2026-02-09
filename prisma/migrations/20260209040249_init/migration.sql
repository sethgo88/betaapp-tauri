-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "synced" BOOLEAN NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Climb" (
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

    CONSTRAINT "Climb_pkey" PRIMARY KEY ("id")
);
