const ACCESS_MODULES = [
  "Dashboard",
  "Tasks",
  "Meetings",
  "Clients",
  "Calls",
  "Messages",
  "Support",
  "Settings",
];

const ROLE_ALIASES = new Map([
  ["superadmin", "Super Admin"],
  ["super admin", "Super Admin"],
  ["admin", "Admin"],
  ["sales manager", "Sales Manager"],
  ["salesmanager", "Sales Manager"],
  ["sales agent", "Sales Agent"],
  ["salesagent", "Sales Agent"],
  ["support staff", "Support Staff"],
  ["supportstaff", "Support Staff"],
]);

const normalizeRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return ROLE_ALIASES.get(normalized) || role;
};

const normalizeAccessModules = (modules, role) => {
  const normalizedRole = normalizeRole(role);
  const requestedModules = Array.isArray(modules)
    ? modules.filter((module) => ACCESS_MODULES.includes(module))
    : [];
  const uniqueModules = [...new Set(requestedModules)].filter(
    (module) =>
      module !== "Settings" ||
      ["Super Admin", "Admin"].includes(normalizedRole),
  );

  if (normalizedRole === "Super Admin" && !uniqueModules.includes("Settings")) {
    uniqueModules.push("Settings");
  }

  return uniqueModules;
};

const normalizeUserAccess = (user) => {
  if (!user) return user;

  const role = normalizeRole(user.role);
  const accessModules = normalizeAccessModules(user.accessModules, role);

  user.role = role;
  user.accessModules = accessModules;
  return user;
};

const serializeUserAccess = (user) => {
  const normalized = normalizeUserAccess({ ...user });
  return {
    ...normalized,
    roleTemplate: normalized.role,
    accessModules: normalized.accessModules,
    permissions: normalized.accessModules,
  };
};

module.exports = {
  ACCESS_MODULES,
  normalizeRole,
  normalizeAccessModules,
  normalizeUserAccess,
  serializeUserAccess,
};
