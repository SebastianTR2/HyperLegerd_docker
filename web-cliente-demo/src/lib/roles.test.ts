import { roleFromBackend, rolePermissions } from "./roles";

describe("roles mapping", () => {
  it("mapea roles de backend a rol de UI", () => {
    expect(roleFromBackend("admin")).toBe("admin");
    expect(roleFromBackend("integrador")).toBe("integrador");
    expect(roleFromBackend("lectura")).toBe("solo_lectura");
    expect(roleFromBackend("solo_lectura")).toBe("solo_lectura");
    expect(roleFromBackend("desconocido")).toBe("solo_lectura");
  });

  it("expone notificaciones admin solo para rol admin", () => {
    expect(rolePermissions("admin").canSeeAdminNotifications).toBe(true);
    expect(rolePermissions("integrador").canSeeAdminNotifications).toBe(false);
    expect(rolePermissions("solo_lectura").canSeeAdminNotifications).toBe(false);
  });
});
