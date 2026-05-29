import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuditarPage from "./AuditarPage";
import { useSettings } from "../context/SettingsContext";
import { fetchAuditoriaCombinada } from "../services/apiAuditoria";

vi.mock("../context/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../services/apiAuditoria", () => ({
  fetchAuditoriaCombinada: vi.fn(),
}));

vi.mock("../services/apiHistorialCliente", () => ({
  fetchHistorialCliente: vi.fn(),
  fetchLineaTiempoCliente: vi.fn(),
  operacionesAVista: vi.fn(() => []),
}));

const useSettingsMock = vi.mocked(useSettings);
const fetchAuditoriaCombinadaMock = vi.mocked(fetchAuditoriaCombinada);

describe("AuditarPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("consulta auditoría y renderiza resumen de resultados", async () => {
    useSettingsMock.mockReturnValue({
      mode: "api",
      apiKey: "jwt",
    } as never);

    fetchAuditoriaCombinadaMock.mockResolvedValue({
      httpPuente: [],
      eventosCadena: [],
      totalHttp: 0,
      totalEventos: 0,
    });

    render(
      <MemoryRouter>
        <AuditarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));

    await waitFor(() => expect(fetchAuditoriaCombinadaMock).toHaveBeenCalled());
    expect(screen.getByText(/HTTP: 0 filas/)).toBeInTheDocument();
  });
});
