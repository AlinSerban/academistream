CREATE TABLE "health_checks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "health_checks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"labels" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
