import { UnauthorizedException } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DatabasePort } from "../src/database/database.port";
import { SupabaseAuthVerifier } from "../src/auth/supabase-auth-verifier";

export const TEST_SUPER_ADMIN_TOKEN = "test-super-admin-token";
export const TEST_UNASSIGNED_TOKEN = "test-unassigned-user-token";
export const TEST_SUPER_ADMIN_ID = "50000000-0000-4000-8000-000000000001";
export const TEST_UNASSIGNED_USER_ID = "50000000-0000-4000-8000-000000000002";

const testIdentities = new Map([
  [
    TEST_SUPER_ADMIN_TOKEN,
    { userId: TEST_SUPER_ADMIN_ID, email: "admin@example.test" },
  ],
  [
    TEST_UNASSIGNED_TOKEN,
    { userId: TEST_UNASSIGNED_USER_ID, email: "staff@example.test" },
  ],
]);

export async function createTestApplication(
  options: {
    bootstrapSuperAdmin?: boolean;
  } = {},
): Promise<{ application: INestApplication; baseUrl: string }> {
  const { AppModule } = await import("../src/app.module");
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseAuthVerifier)
    .useValue({
      async verify(token: string) {
        const identity = testIdentities.get(token);
        if (!identity) {
          throw new UnauthorizedException("Invalid test token");
        }
        return identity;
      },
    })
    .compile();

  const application = module.createNestApplication({ logger: false });
  await application.init();
  if (options?.bootstrapSuperAdmin !== false) {
    await application
      .get(DatabasePort)
      .claimInitialSuperAdmin(TEST_SUPER_ADMIN_ID);
  }
  await application.listen(0, "127.0.0.1");
  const address = application.getHttpServer().address() as { port: number };

  return {
    application,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

export function staffFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${TEST_SUPER_ADMIN_TOKEN}`);
  return fetch(url, { ...init, headers });
}
