import { fetchCompanies, fetchMe, fetchMyCompanyAccess } from "@/lib/api-client";
import type { Company, CompanyAccess, UserMe } from "@/lib/api-types";

export type SessionSnapshot = {
  user: UserMe;
  companies: Company[];
};

export async function loadSessionSnapshot() {
  const [user, companies] = await Promise.all([fetchMe(), fetchCompanies()]);
  return { user, companies } as SessionSnapshot;
}

export async function loadCompanyAccess(companyId: string): Promise<CompanyAccess> {
  return fetchMyCompanyAccess(companyId);
}
