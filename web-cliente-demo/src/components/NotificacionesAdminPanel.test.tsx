import { render, screen } from "@testing-library/react";
import { NotificacionesAdminPanel } from "./NotificacionesAdminPanel";
import { useSettings } from "../context/SettingsContext";
import { useDemoStore } from "../context/DemoStoreContext";
import { useNotificacionesAdmin } from "../lib/notificacionesAdminHook";

vi.mock("../context/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../context/DemoStoreContext", () => ({
  useDemoStore: vi.fn(),
}));

vi.mock("../lib/notificacionesAdminHook", () => ({
  useNotificacionesAdmin: vi.fn(),
}));

const useSettingsMock = vi.mocked(useSettings);
const useDemoStoreMock = vi.mocked(useDemoStore);
const useNotificacionesAdminMock = vi.mocked(useNotificacionesAdmin);

function mockCommonDeps() {
  useDemoStoreMock.mockReturnValue({
    showToast: vi.fn(),
  } as never);
  useNotificacionesAdminMock.mockReturnValue({
    items: [],
    estado: "conectado",
    errorMensaje: null,
    noLeidas: 0,
    marcarLeidas: vi.fn(),
    reintentar: vi.fn(),
    limpiar: vi.fn(),
  });
}

describe("NotificacionesAdminPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("no renderiza campana cuando el rol no es admin", () => {
    mockCommonDeps();
    useSettingsMock.mockReturnValue({
      role: "integrador",
      mode: "api",
      apiKey: "jwt",
    } as never);

    render(<NotificacionesAdminPanel />);

    expect(screen.queryByTitle("Centro de avisos")).not.toBeInTheDocument();
  });

  it("no renderiza campana cuando no hay token/apiKey", () => {
    mockCommonDeps();
    useSettingsMock.mockReturnValue({
      role: "admin",
      mode: "api",
      apiKey: "   ",
    } as never);

    render(<NotificacionesAdminPanel />);

    expect(screen.queryByTitle("Centro de avisos")).not.toBeInTheDocument();
  });

  it("renderiza campana cuando es admin en modo API con token", () => {
    mockCommonDeps();
    useSettingsMock.mockReturnValue({
      role: "admin",
      mode: "api",
      apiKey: "jwt",
    } as never);

    render(<NotificacionesAdminPanel />);

    expect(screen.getByTitle("Centro de avisos")).toBeInTheDocument();
    expect(screen.getByText("Avisos")).toBeInTheDocument();
  });
});
