package notificador

import (
	"fmt"
	"sync"

	"api-middleware/internal/bitacora"
)

// ClienteSSE es un suscriptor conectado al stream de notificaciones admin.
// Cada cliente queda asociado a un único tenant para garantizar aislamiento:
// un admin del tenant clientes nunca recibe eventos de agricultura.
type ClienteSSE struct {
	Tenant string
	Canal  chan EventoNotificacion
}

// BrokerSSE retransmite eventos a los clientes admin conectados.
type BrokerSSE struct {
	mu        sync.RWMutex
	clientes  map[*ClienteSSE]struct{}
	historial []EventoNotificacion
}

// HistorialMaximoSSE limita el ringbuffer del histórico para reenviar a los
// que se conectan después de que pasó un evento.
const HistorialMaximoSSE = 50

// NuevoBrokerSSE construye un broker vacío.
func NuevoBrokerSSE() *BrokerSSE {
	return &BrokerSSE{
		clientes:  map[*ClienteSSE]struct{}{},
		historial: make([]EventoNotificacion, 0, HistorialMaximoSSE),
	}
}

// AgregarCliente registra un nuevo suscriptor para un tenant concreto.
// El llamador es responsable de leer del canal y, al desconectarse,
// llamar QuitarCliente para liberar recursos.
func (b *BrokerSSE) AgregarCliente(tenant string) *ClienteSSE {
	c := &ClienteSSE{
		Tenant: tenant,
		Canal:  make(chan EventoNotificacion, 16),
	}
	b.mu.Lock()
	b.clientes[c] = struct{}{}
	b.mu.Unlock()
	return c
}

// QuitarCliente desuscribe y cierra el canal asociado.
func (b *BrokerSSE) QuitarCliente(c *ClienteSSE) {
	if c == nil {
		return
	}
	b.mu.Lock()
	if _, ok := b.clientes[c]; ok {
		delete(b.clientes, c)
		close(c.Canal)
	}
	b.mu.Unlock()
}

// Broadcast envía el evento a todos los clientes cuyo tenant coincida con el
// del evento, y guarda una copia en el historial reciente.
func (b *BrokerSSE) Broadcast(ev EventoNotificacion) {
	b.mu.Lock()
	b.historial = append(b.historial, ev)
	if len(b.historial) > HistorialMaximoSSE {
		b.historial = b.historial[1:]
	}
	descartados := 0
	for c := range b.clientes {
		if c.Tenant != "" && c.Tenant != ev.Tenant {
			continue
		}
		select {
		case c.Canal <- ev:
		default:
			descartados++
		}
	}
	b.mu.Unlock()

	if descartados > 0 {
		bitacora.RegistrarFalloEvento(bitacora.EntradaBitacoraEvento{
			Categoria: "NOTIFICACION_SSE_DROPPED",
			Contrato:  ev.Tenant,
			Mensaje: fmt.Sprintf(
				"%d suscriptor(es) SSE no recibieron la notificación %s (recurso=%s)",
				descartados, ev.Tipo, ev.Recurso,
			),
		})
	}
}

// PurgarPorTenant elimina del histórico los eventos del tenant indicado y
// devuelve cuántos se quitaron. Si tenant es vacío, vacía todo el histórico.
func (b *BrokerSSE) PurgarPorTenant(tenant string) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	if tenant == "" {
		n := len(b.historial)
		b.historial = b.historial[:0]
		return n
	}
	conservados := b.historial[:0:0]
	quitados := 0
	for _, ev := range b.historial {
		if ev.Tenant == tenant {
			quitados++
			continue
		}
		conservados = append(conservados, ev)
	}
	b.historial = conservados
	return quitados
}

// HistorialPorTenant devuelve los últimos eventos para un tenant (lo último primero).
// Si tenant es vacío, devuelve todos.
func (b *BrokerSSE) HistorialPorTenant(tenant string) []EventoNotificacion {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]EventoNotificacion, 0, len(b.historial))
	for i := len(b.historial) - 1; i >= 0; i-- {
		ev := b.historial[i]
		if tenant == "" || ev.Tenant == tenant {
			out = append(out, ev)
		}
	}
	return out
}
