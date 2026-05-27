package usuariosadmin

import (
	"errors"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func bcryptDe(t *testing.T, password string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("bcrypt: %v", err)
	}
	return string(h)
}

func TestLoadFromBytes_Valido(t *testing.T) {
	hashAna := bcryptDe(t, "secret-ana")
	hashCarlos := bcryptDe(t, "secret-carlos")
	doc := []byte(`
default_tenant: clientes
tenants:
  clientes:
    nombre: "Base"
    api_keys:
      admin: sec-admin
      integrador: sec-int
      lectura: sec-lect
  agricultura:
    nombre: "Agri"
    api_keys:
      admin: agri-admin
      integrador: agri-int
      lectura: agri-lect
usuarios:
  - usuario: ana
    contrasena_hash: "` + hashAna + `"
    nombre_completo: "Ana Pérez"
    rol: integrador
    tenant: clientes
  - usuario: carlos
    contrasena_hash: "` + hashCarlos + `"
    nombre_completo: "Carlos Mamani"
    rol: admin
    tenant: clientes
`)
	r := Nuevo()
	if err := r.LoadFromBytes(doc); err != nil {
		t.Fatalf("LoadFromBytes: %v", err)
	}
	cargada, _, _, total := r.Estado()
	if !cargada || total != 2 {
		t.Fatalf("estado inesperado: cargada=%v total=%d", cargada, total)
	}

	u, err := r.Autenticar("ana", "secret-ana")
	if err != nil {
		t.Fatalf("Autenticar ana: %v", err)
	}
	if u.Rol != "integrador" || u.Tenant != "clientes" || u.NombreCompleto != "Ana Pérez" {
		t.Fatalf("usuario inesperado: %+v", u)
	}
	if u.ContrasenaHash != "" {
		t.Fatalf("hash no debe exponerse")
	}

	if _, err := r.Autenticar("ana", "wrong"); !errors.Is(err, ErrCredencialInvalida) {
		t.Fatalf("contraseña errónea debió dar ErrCredencialInvalida, dio: %v", err)
	}
	if _, err := r.Autenticar("desconocido", "x"); !errors.Is(err, ErrCredencialInvalida) {
		t.Fatalf("usuario desconocido debió dar ErrCredencialInvalida, dio: %v", err)
	}

	if k := r.APIKeyPara("clientes", "integrador"); k != "sec-int" {
		t.Fatalf("api_key esperada sec-int, obtuvo %q", k)
	}
	if k := r.APIKeyPara("agricultura", "admin"); k != "agri-admin" {
		t.Fatalf("api_key esperada agri-admin, obtuvo %q", k)
	}
	if k := r.APIKeyPara("noexiste", "admin"); k != "" {
		t.Fatalf("api_key debe ser vacía para tenant desconocido")
	}
}

func TestLoadFromBytes_ValidacionesNegativas(t *testing.T) {
	r := Nuevo()
	casos := []struct {
		nombre string
		yaml   string
	}{
		{"sin tenants", "default_tenant: x\nusuarios: []\n"},
		{"usuario sin hash", `
default_tenant: clientes
tenants:
  clientes:
    api_keys: { admin: sec-admin }
usuarios:
  - usuario: ana
    rol: admin
    tenant: clientes
`},
		{"rol inválido", `
default_tenant: clientes
tenants:
  clientes:
    api_keys: { admin: sec-admin }
usuarios:
  - usuario: ana
    contrasena_hash: "x"
    rol: superusuario
    tenant: clientes
`},
		{"tenant inexistente para usuario", `
default_tenant: clientes
tenants:
  clientes:
    api_keys: { admin: sec-admin }
usuarios:
  - usuario: ana
    contrasena_hash: "x"
    rol: admin
    tenant: agricultura
`},
		{"sin api_key para rol", `
default_tenant: clientes
tenants:
  clientes:
    api_keys: { admin: sec-admin }
usuarios:
  - usuario: ana
    contrasena_hash: "x"
    rol: integrador
    tenant: clientes
`},
	}
	for _, ca := range casos {
		t.Run(ca.nombre, func(t *testing.T) {
			if err := r.LoadFromBytes([]byte(ca.yaml)); err == nil {
				t.Fatalf("se esperaba error para %q", ca.nombre)
			}
		})
	}
}

func TestUsuarioInactivo(t *testing.T) {
	hash := bcryptDe(t, "p")
	no := false
	doc := []byte(`
default_tenant: clientes
tenants:
  clientes:
    api_keys: { admin: sec-admin }
usuarios:
  - usuario: ana
    contrasena_hash: "` + hash + `"
    rol: admin
    tenant: clientes
    activo: false
`)
	r := Nuevo()
	if err := r.LoadFromBytes(doc); err != nil {
		t.Fatalf("load: %v", err)
	}
	_, _ = no, r
	if _, err := r.Autenticar("ana", "p"); !errors.Is(err, ErrUsuarioInactivo) {
		t.Fatalf("usuario inactivo debió dar ErrUsuarioInactivo, dio: %v", err)
	}
}
