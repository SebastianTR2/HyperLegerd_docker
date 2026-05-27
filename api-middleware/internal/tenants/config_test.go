package tenants

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadFromFile_DosTenants(t *testing.T) {
	dir := t.TempDir()
	yamlPath := filepath.Join(dir, "tenants.yaml")
	yaml := `default: clientes
tenants:
  clientes:
    nombre: "Base"
    msp_id: Org1MSP
    canal: clientes
    chaincode: cliente_cc
    api_keys:
      "sec-admin": admin
      "sec-int": integrador
  agricultura:
    nombre: "Agri"
    msp_id: Org3MSP
    canal: agricultura
    chaincode: dato_cc
    api_keys:
      "agri-admin": admin
      "agri-lect": solo_lectura
`
	if err := os.WriteFile(yamlPath, []byte(yaml), 0o644); err != nil {
		t.Fatalf("write tmp yaml: %v", err)
	}
	reg, err := LoadFromFile(yamlPath)
	if err != nil {
		t.Fatalf("LoadFromFile: %v", err)
	}
	if got := len(reg.Tenants); got != 2 {
		t.Fatalf("esperados 2 tenants, got %d", got)
	}
	if reg.Default != "clientes" {
		t.Fatalf("default debería ser clientes, got %s", reg.Default)
	}
	cases := []struct {
		key      string
		tenant   string
		role     string
		notFound bool
	}{
		{"sec-admin", "clientes", RoleAdmin, false},
		{"sec-int", "clientes", RoleIntegrador, false},
		{"agri-admin", "agricultura", RoleAdmin, false},
		{"agri-lect", "agricultura", RoleSoloLectura, false},
		{"clave-fantasma", "", "", true},
	}
	for _, tc := range cases {
		m, ok := reg.Lookup(tc.key)
		if tc.notFound {
			if ok {
				t.Errorf("key %q no debería existir", tc.key)
			}
			continue
		}
		if !ok {
			t.Errorf("key %q debería existir", tc.key)
			continue
		}
		if m.TenantID != tc.tenant || m.Rol != tc.role {
			t.Errorf("key %q → got (%s,%s), want (%s,%s)", tc.key, m.TenantID, m.Rol, tc.tenant, tc.role)
		}
	}
}

func TestLoadFromFile_KeyDuplicadaFalla(t *testing.T) {
	dir := t.TempDir()
	yamlPath := filepath.Join(dir, "tenants.yaml")
	yaml := `default: a
tenants:
  a:
    msp_id: Org1MSP
    api_keys:
      "dup": admin
  b:
    msp_id: Org3MSP
    api_keys:
      "dup": admin
`
	if err := os.WriteFile(yamlPath, []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadFromFile(yamlPath); err == nil {
		t.Fatal("se esperaba error por API key duplicada entre tenants")
	}
}

func TestLoadFromEnvLegacy(t *testing.T) {
	t.Setenv("MSPID", "Org1MSP")
	t.Setenv("CHANNEL_NAME", "clientes")
	t.Setenv("CHAINCODE_NAME", "cliente_cc")
	t.Setenv("API_KEY_ADMIN", "sec-admin-x")
	t.Setenv("API_KEY_INTEGRADOR", "sec-int-x")
	t.Setenv("API_KEY_SOLO_LECTURA", "sec-lect-x")
	reg, err := LoadFromEnvLegacy()
	if err != nil {
		t.Fatalf("LoadFromEnvLegacy: %v", err)
	}
	if reg.Default != DefaultTenantID {
		t.Fatalf("default %s != %s", reg.Default, DefaultTenantID)
	}
	t1 := reg.Get(DefaultTenantID)
	if t1 == nil {
		t.Fatal("no se creó tenant clientes")
	}
	if t1.MSPID != "Org1MSP" {
		t.Errorf("mspid %s != Org1MSP", t1.MSPID)
	}
	if m, ok := reg.Lookup("sec-admin-x"); !ok || m.Rol != RoleAdmin || m.TenantID != DefaultTenantID {
		t.Errorf("legacy admin no mapeó al tenant clientes: %+v ok=%v", m, ok)
	}
	if m, ok := reg.Lookup("sec-lect-x"); !ok || m.Rol != RoleSoloLectura {
		t.Errorf("legacy lectura no mapeó como solo_lectura: %+v ok=%v", m, ok)
	}
}

func TestLoad_RespetaTenantsFile(t *testing.T) {
	dir := t.TempDir()
	yamlPath := filepath.Join(dir, "tenants.yaml")
	yaml := `default: a
tenants:
  a:
    msp_id: Org1MSP
    canal: a
    chaincode: cc_a
    api_keys: {"ka": admin}
`
	if err := os.WriteFile(yamlPath, []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv(EnvTenantsFile, yamlPath)
	reg, src, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if src != yamlPath {
		t.Errorf("src %s != %s", src, yamlPath)
	}
	if reg.Default != "a" {
		t.Errorf("default %s != a", reg.Default)
	}
}

func TestLoad_FallbackAEnv(t *testing.T) {
	t.Setenv(EnvTenantsFile, "/no/existe/tenants.yaml")
	t.Setenv("MSPID", "Org1MSP")
	t.Setenv("API_KEY_ADMIN", "demo")
	reg, src, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if src != "" {
		t.Errorf("src debió quedar vacío en modo legacy, got %s", src)
	}
	if _, ok := reg.Lookup("demo"); !ok {
		t.Errorf("modo legacy no incluyó la key demo")
	}
}
