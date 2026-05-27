// Package usuariosadmin gestiona las cuentas de usuario que acceden a la
// consola del puente (web-cliente-demo). A diferencia de las cuentas del
// portal-cliente final (que viven en SQLite), estas cuentas se administran
// en un archivo YAML versionado por el dueño del BaaS.
//
// Cada usuario está vinculado a un (tenant, rol). El archivo además declara
// las X-API-Key reales del middleware para cada (tenant, rol). Estas keys
// JAMÁS salen del BFF: se inyectan al proxy hacia api-middleware al
// reenviar la petición, y el frontend nunca las ve.
package usuariosadmin

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

// Errores públicos.
var (
	ErrConfiguracionAusente = errors.New("usuariosadmin no configurado")
	ErrUsuarioNoEncontrado  = errors.New("usuario o contraseña incorrectos")
	ErrCredencialInvalida   = errors.New("usuario o contraseña incorrectos")
	ErrUsuarioInactivo      = errors.New("usuario deshabilitado")
	ErrRolDesconocido       = errors.New("rol desconocido para el tenant")
)

// Rol canónico (coincide con tenants.Role* del api-middleware).
const (
	RolAdmin       = "admin"
	RolIntegrador  = "integrador"
	RolSoloLectura = "lectura"
)

// Usuario representa una cuenta humana de la consola.
type Usuario struct {
	Usuario        string `yaml:"usuario"`
	ContrasenaHash string `yaml:"contrasena_hash"`
	NombreCompleto string `yaml:"nombre_completo"`
	Rol            string `yaml:"rol"`
	Tenant         string `yaml:"tenant"`
	Activo         *bool  `yaml:"activo,omitempty"` // nil = true; explícito false desactiva
}

// TenantConfig declara las X-API-Key reales que el BFF inyectará al proxy.
type TenantConfig struct {
	Nombre  string            `yaml:"nombre,omitempty"`
	APIKeys map[string]string `yaml:"api_keys"`
}

// Configuracion es el documento completo cargado desde YAML.
type Configuracion struct {
	DefaultTenant string                  `yaml:"default_tenant"`
	Tenants       map[string]TenantConfig `yaml:"tenants"`
	Usuarios      []Usuario               `yaml:"usuarios"`
}

// Registry mantiene la configuración resuelta en memoria. Es seguro para
// uso concurrente; las mutaciones (recargas) reemplazan el snapshot completo.
type Registry struct {
	mu        sync.RWMutex
	cargada   bool
	cargadaEn time.Time
	rutaYAML  string
	cfg       Configuracion

	// Índice por username (lower-case) → puntero al usuario en cfg.Usuarios.
	indice map[string]*Usuario
}

// Nuevo crea un registro vacío. Llama LoadFromFile o LoadFromBytes antes
// de usarlo.
func Nuevo() *Registry { return &Registry{indice: map[string]*Usuario{}} }

// LoadFromFile lee y reemplaza la configuración. Si la ruta está vacía o
// el archivo no existe, el registro queda sin configurar y devuelve
// ErrConfiguracionAusente (no es un error fatal: el BFF puede arrancar y
// servir solo las rutas del portal-cliente legacy).
func (r *Registry) LoadFromFile(ruta string) error {
	ruta = strings.TrimSpace(ruta)
	if ruta == "" {
		return ErrConfiguracionAusente
	}
	raw, err := os.ReadFile(ruta)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrConfiguracionAusente
		}
		return fmt.Errorf("leer %s: %w", ruta, err)
	}
	if err := r.LoadFromBytes(raw); err != nil {
		return fmt.Errorf("%s: %w", ruta, err)
	}
	r.mu.Lock()
	r.rutaYAML = ruta
	r.mu.Unlock()
	return nil
}

// LoadFromBytes parsea y aplica el documento YAML.
func (r *Registry) LoadFromBytes(raw []byte) error {
	var doc Configuracion
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return fmt.Errorf("parsear YAML: %w", err)
	}
	if len(doc.Usuarios) == 0 {
		return errors.New("sin usuarios definidos")
	}
	if len(doc.Tenants) == 0 {
		return errors.New("sin tenants definidos")
	}
	if strings.TrimSpace(doc.DefaultTenant) == "" {
		// Tomar el primer tenant en orden alfabético como default estable.
		var first string
		for id := range doc.Tenants {
			if first == "" || id < first {
				first = id
			}
		}
		doc.DefaultTenant = first
	}
	if _, ok := doc.Tenants[doc.DefaultTenant]; !ok {
		return fmt.Errorf("default_tenant %q no está declarado en tenants", doc.DefaultTenant)
	}

	// Validar usuarios y construir índice.
	idx := make(map[string]*Usuario, len(doc.Usuarios))
	for i := range doc.Usuarios {
		u := &doc.Usuarios[i]
		u.Usuario = strings.TrimSpace(u.Usuario)
		u.Rol = normalizarRol(u.Rol)
		u.Tenant = strings.TrimSpace(u.Tenant)
		if u.Tenant == "" {
			u.Tenant = doc.DefaultTenant
		}
		if u.Usuario == "" {
			return fmt.Errorf("usuario en posición %d sin nombre", i)
		}
		if u.ContrasenaHash == "" {
			return fmt.Errorf("usuario %q sin contrasena_hash", u.Usuario)
		}
		if u.Rol == "" {
			return fmt.Errorf("usuario %q con rol inválido", u.Usuario)
		}
		t, ok := doc.Tenants[u.Tenant]
		if !ok {
			return fmt.Errorf("usuario %q apunta a tenant desconocido %q", u.Usuario, u.Tenant)
		}
		if _, ok := t.APIKeys[u.Rol]; !ok {
			return fmt.Errorf("tenant %q no declara api_key para rol %q (usuario=%q)", u.Tenant, u.Rol, u.Usuario)
		}
		key := strings.ToLower(u.Usuario)
		if _, dup := idx[key]; dup {
			return fmt.Errorf("usuario duplicado: %q", u.Usuario)
		}
		idx[key] = u
	}

	r.mu.Lock()
	r.cfg = doc
	r.indice = idx
	r.cargada = true
	r.cargadaEn = time.Now().UTC()
	r.mu.Unlock()
	return nil
}

// Estado devuelve si el registro está cargado.
func (r *Registry) Estado() (cargada bool, ruta string, cargadaEn time.Time, totalUsuarios int) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.cargada, r.rutaYAML, r.cargadaEn, len(r.indice)
}

// Autenticar verifica credenciales en constant-time (bcrypt). Devuelve una
// copia del usuario (no expone el hash al llamador). Si el usuario no
// existe, igualmente compara contra un hash falso para reducir el oráculo
// de tiempo.
func (r *Registry) Autenticar(username, password string) (Usuario, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if !r.cargada {
		return Usuario{}, ErrConfiguracionAusente
	}
	key := strings.ToLower(strings.TrimSpace(username))
	u, ok := r.indice[key]
	if !ok {
		// Hash dummy para igualar la latencia frente a usuarios reales.
		// La comparación siempre falla, pero gasta el mismo tiempo.
		_ = bcrypt.CompareHashAndPassword([]byte(hashDummy), []byte(password))
		return Usuario{}, ErrCredencialInvalida
	}
	if u.Activo != nil && !*u.Activo {
		return Usuario{}, ErrUsuarioInactivo
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.ContrasenaHash), []byte(password)); err != nil {
		return Usuario{}, ErrCredencialInvalida
	}
	cp := *u
	cp.ContrasenaHash = ""
	return cp, nil
}

// APIKeyPara devuelve la X-API-Key real para (tenant, rol). Vacío si no
// está declarada.
func (r *Registry) APIKeyPara(tenant, rol string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.cfg.Tenants[strings.TrimSpace(tenant)]
	if !ok {
		return ""
	}
	return strings.TrimSpace(t.APIKeys[normalizarRol(rol)])
}

// DefaultTenant devuelve el tenant por defecto del registro.
func (r *Registry) DefaultTenant() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.cfg.DefaultTenant
}

// TenantConocido indica si el tenant existe en el registro.
func (r *Registry) TenantConocido(tenant string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.cfg.Tenants[strings.TrimSpace(tenant)]
	return ok
}

func normalizarRol(r string) string {
	switch strings.ToLower(strings.TrimSpace(r)) {
	case "admin":
		return RolAdmin
	case "integrador":
		return RolIntegrador
	case "lectura", "solo_lectura", "solo-lectura":
		return RolSoloLectura
	default:
		return ""
	}
}

// hashDummy es un bcrypt válido para "no-existe". Se usa solo para
// igualar la latencia ante usuarios inexistentes.
const hashDummy = `$2a$10$abcdefghijklmnopqrstuv0HGcm9KQHmYZqKwGr2cKkdY3iI5g36ee`
