import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequiereSesion } from "./RequiereSesion";
import { useAuth } from "../context/AuthContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/privada"
          element={
            <RequiereSesion>
              <div>Ruta protegida</div>
            </RequiereSesion>
          }
        />
        <Route path="/login" element={<div>Página login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequiereSesion", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("muestra estado de verificación cuando auth está verificando", () => {
    useAuthMock.mockReturnValue({
      estado: "verificando",
      token: null,
      usuario: null,
      login: vi.fn(),
      logout: vi.fn(),
      obtenerToken: () => null,
    });

    renderWithRouter("/privada");

    expect(screen.getByText("Validando sesión…")).toBeInTheDocument();
    expect(screen.queryByText("Ruta protegida")).not.toBeInTheDocument();
  });

  it("redirige a login cuando no hay sesión", () => {
    useAuthMock.mockReturnValue({
      estado: "sin-sesion",
      token: null,
      usuario: null,
      login: vi.fn(),
      logout: vi.fn(),
      obtenerToken: () => null,
    });

    renderWithRouter("/privada");

    expect(screen.getByText("Página login")).toBeInTheDocument();
  });

  it("renderiza la ruta privada cuando hay sesión autenticada", () => {
    useAuthMock.mockReturnValue({
      estado: "autenticado",
      token: "jwt",
      usuario: { usuario: "carlos", nombreCompleto: "Carlos Admin", rol: "admin", tenant: "clientes" },
      login: vi.fn(),
      logout: vi.fn(),
      obtenerToken: () => "jwt",
    });

    renderWithRouter("/privada");

    expect(screen.getByText("Ruta protegida")).toBeInTheDocument();
  });
});
