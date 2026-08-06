const {
  normalizeAccessModules,
  normalizeRole,
  serializeUserAccess,
} = require("../utils/userAccess");

describe("user access normalization", () => {
  test("normalizes legacy SuperAdmin values and guarantees Settings", () => {
    const user = serializeUserAccess({
      _id: "user-1",
      role: " superadmin ",
      accessModules: ["Dashboard"],
    });

    expect(user.role).toBe("Super Admin");
    expect(user.roleTemplate).toBe("Super Admin");
    expect(user.accessModules).toEqual(["Dashboard", "Settings"]);
    expect(user.permissions).toEqual(["Dashboard", "Settings"]);
  });

  test("keeps Settings for Super Admin access edits", () => {
    expect(normalizeAccessModules(["Calls"], "Super Admin")).toEqual([
      "Calls",
      "Settings",
    ]);
  });

  test("returns Settings for Admin only when it is granted", () => {
    expect(normalizeAccessModules(["Dashboard", "Settings"], "Admin")).toEqual([
      "Dashboard",
      "Settings",
    ]);
    expect(normalizeAccessModules(["Dashboard"], "Admin")).toEqual(["Dashboard"]);
  });

  test("does not grant Settings to non-privileged roles", () => {
    expect(normalizeAccessModules(["Settings", "Tasks"], "Sales Manager")).toEqual([
      "Tasks",
    ]);
    expect(normalizeRole("salesagent")).toBe("Sales Agent");
  });
});
