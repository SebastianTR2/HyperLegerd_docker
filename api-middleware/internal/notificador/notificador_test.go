package notificador

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"api-middleware/internal/tenants"
)

// canalSpy implementa CanalSalida y cuenta cuántas entregas recibe por tenant.
type canalSpy struct {
	nombre  string
	entregas atomic.Int32
	mu      sync.Mutex
	ultimas []EventoNotificacion
}

func (c *canalSpy) Nombre() string { return c.nombre }
func (c *canalSpy) Entregar(_ context.Context, ev EventoNotificacion, _ tenants.DestinoNotificacion) error {
	c.entregas.Add(1)
	c.mu.Lock()
	c.ultimas = append(c.ultimas, ev)
	c.mu.Unlock()
	return nil
}

func registroSimple(notif *tenants.NotificacionesTenant) *tenants.Registry {
	reg := &tenants.Registry{
		Default: "clientes",
		Tenants: map[string]*tenants.Tenant{
			"clientes": {
				ID:             "clientes",
				Nombre:         "Base",
				MSPID:          "Org1MSP",
				Canal:          "clientes",
				Chaincode:      "cliente_cc",
				APIKeys:        map[string]string{"sec-admin": "admin"},
				Notificaciones: notif,
			},
		},
	}
	return reg
}

func TestPublicar_RutaPorTipoYRol(t *testing.T) {
	reg := registroSimple(&tenants.NotificacionesTenant{
		Activado:   true,
		Eventos:    []string{"cliente.editado"},
		RolesActor: []string{"integrador"},
		Destinos: []tenants.DestinoNotificacion{
			{Tipo: "email", Destinatarios: []string{"a@b.com"}},
		},
	})
	n := Nuevo(reg, 16)
	spy := &canalSpy{nombre: "email"}
	n.RegistrarCanal(spy)
	n.Iniciar(context.Background())
	defer n.Detener()

	// Esperado: pasa los filtros.
	n.Publicar(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.editado", ActorRol: "integrador", Recurso: "Cli1"})
	// Filtrado por tipo (cliente.creado no está en la lista).
	n.Publicar(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.creado", ActorRol: "integrador", Recurso: "Cli2"})
	// Filtrado por rol (admin no está en la lista permitida).
	n.Publicar(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.editado", ActorRol: "admin", Recurso: "Cli3"})

	esperaEntregas(t, spy, 1)
}

func TestPublicar_TenantDesconocidoNoNotifica(t *testing.T) {
	reg := registroSimple(&tenants.NotificacionesTenant{
		Activado: true,
		Destinos: []tenants.DestinoNotificacion{
			{Tipo: "email", Destinatarios: []string{"x@y.com"}},
		},
	})
	n := Nuevo(reg, 16)
	spy := &canalSpy{nombre: "email"}
	n.RegistrarCanal(spy)
	n.Iniciar(context.Background())
	defer n.Detener()

	n.Publicar(EventoNotificacion{Tenant: "agricultura", Tipo: "cliente.editado", ActorRol: "integrador"})
	time.Sleep(120 * time.Millisecond)

	if got := spy.entregas.Load(); got != 0 {
		t.Fatalf("se esperaba 0 entregas para tenant desconocido, obtuvo %d", got)
	}
}

func TestPublicar_ActivadoFalseNoNotifica(t *testing.T) {
	reg := registroSimple(&tenants.NotificacionesTenant{
		Activado: false,
		Destinos: []tenants.DestinoNotificacion{
			{Tipo: "email", Destinatarios: []string{"x@y.com"}},
		},
	})
	n := Nuevo(reg, 16)
	spy := &canalSpy{nombre: "email"}
	n.RegistrarCanal(spy)
	n.Iniciar(context.Background())
	defer n.Detener()

	n.Publicar(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.editado", ActorRol: "integrador"})
	time.Sleep(120 * time.Millisecond)

	if got := spy.entregas.Load(); got != 0 {
		t.Fatalf("se esperaba 0 entregas cuando notificaciones.activado=false, obtuvo %d", got)
	}
}

func TestBrokerSSE_FiltraPorTenant(t *testing.T) {
	b := NuevoBrokerSSE()
	c1 := b.AgregarCliente("clientes")
	c2 := b.AgregarCliente("agricultura")
	defer b.QuitarCliente(c1)
	defer b.QuitarCliente(c2)

	b.Broadcast(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.editado"})
	b.Broadcast(EventoNotificacion{Tenant: "agricultura", Tipo: "dato.creado"})

	if ev := recibirCon(t, c1.Canal, 200*time.Millisecond); ev.Tenant != "clientes" {
		t.Fatalf("cliente1 esperaba evento de 'clientes', obtuvo %q", ev.Tenant)
	}
	if ev := recibirCon(t, c2.Canal, 200*time.Millisecond); ev.Tenant != "agricultura" {
		t.Fatalf("cliente2 esperaba evento de 'agricultura', obtuvo %q", ev.Tenant)
	}
	// c1 no debería recibir el segundo evento.
	select {
	case ev := <-c1.Canal:
		t.Fatalf("c1 recibió un evento del otro tenant: %+v", ev)
	case <-time.After(80 * time.Millisecond):
		// esperado
	}
}

func TestPublicar_BusLlenoSeDescarta(t *testing.T) {
	n := Nuevo(registroSimple(nil), 1)
	// No arrancamos el loop, así el bus se llena en 1 evento.
	if !n.Publicar(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.editado"}) {
		t.Fatalf("primer Publicar debió ser aceptado")
	}
	if n.Publicar(EventoNotificacion{Tenant: "clientes", Tipo: "cliente.editado"}) {
		t.Fatalf("segundo Publicar con bus lleno debió rechazarse")
	}
}

// esperaEntregas hace polling hasta `n` entregas con timeout duro.
func esperaEntregas(t *testing.T, spy *canalSpy, n int32) {
	t.Helper()
	deadline := time.Now().Add(1 * time.Second)
	for time.Now().Before(deadline) {
		if spy.entregas.Load() >= n {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("esperaba al menos %d entregas, obtuvo %d", n, spy.entregas.Load())
}

func recibirCon(t *testing.T, ch <-chan EventoNotificacion, d time.Duration) EventoNotificacion {
	t.Helper()
	select {
	case ev, ok := <-ch:
		if !ok {
			t.Fatalf("canal cerrado inesperadamente")
		}
		return ev
	case <-time.After(d):
		t.Fatalf("timeout esperando evento")
		return EventoNotificacion{}
	}
}
