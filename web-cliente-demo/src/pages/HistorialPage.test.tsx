import { fireEvent, render, screen } from "@testing-library/react";
import HistorialPage from "./HistorialPage";
import { useDemoStore } from "../context/DemoStoreContext";

vi.mock("../context/DemoStoreContext", () => ({
  useDemoStore: vi.fn(),
}));

const useDemoStoreMock = vi.mocked(useDemoStore);

describe("HistorialPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("renderiza operaciones y permite filtrar por tipo", () => {
    useDemoStoreMock.mockReturnValue({
      eventos: [
        {
          id: "1",
          tipo: "registro_creado",
          estado: "exito",
          titulo: "Alta",
          mensaje: "Creado",
          fechaIso: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          tipo: "consulta",
          estado: "exito",
          titulo: "Consulta",
          mensaje: "Consultado",
          fechaIso: "2026-01-02T00:00:00.000Z",
        },
      ],
    } as never);

    render(<HistorialPage />);
    expect(screen.getByText("Historial de operaciones")).toBeInTheDocument();
    expect(screen.getByText("2 operación(es) con el filtro actual")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alta" }));
    expect(screen.getByText("1 operación(es) con el filtro actual")).toBeInTheDocument();
  });
});
