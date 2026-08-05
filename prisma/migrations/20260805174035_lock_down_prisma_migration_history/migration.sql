ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "public"."_prisma_migrations"
FROM PUBLIC, "anon", "authenticated", "service_role";
