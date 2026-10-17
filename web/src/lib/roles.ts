// Prototype access model: no login. A role switcher sets a cookie and every
// server action reads it. Real auth (phone OTP + DB roles) is a finals item.

export const ROLES = ["citizen", "officer", "contractor", "ngo", "public"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_HOME: Record<Role, string> = {
  citizen: "/citizen",
  officer: "/officer",
  contractor: "/contractor",
  ngo: "/ngo",
  public: "/public",
};

/** Demo personas so actions in the audit log have a readable actor. */
export const DEMO_PERSONA: Record<Role, string> = {
  citizen: "Demo Citizen",
  officer: "Demo Ward Officer",
  contractor: "Demo Contractor",
  ngo: "Demo NGO",
  public: "Public visitor",
};
