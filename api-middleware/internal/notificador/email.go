package notificador

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"

	"api-middleware/internal/tenants"
)

// Variables de entorno reconocidas por el canal SMTP.
const (
	EnvSMTPHost      = "NOTIFICADOR_SMTP_HOST"
	EnvSMTPPuerto    = "NOTIFICADOR_SMTP_PUERTO"
	EnvSMTPUsuario   = "NOTIFICADOR_SMTP_USUARIO"
	EnvSMTPPassword  = "NOTIFICADOR_SMTP_CONTRASENA"
	EnvSMTPRemitente = "NOTIFICADOR_SMTP_REMITENTE"
	EnvSMTPStartTLS  = "NOTIFICADOR_SMTP_STARTTLS"
	EnvSMTPModoLog   = "NOTIFICADOR_SMTP_LOG_ONLY"
)

// ConfigSMTP captura los parámetros del servidor SMTP. Si Host está vacío, el
// canal funciona en modo log-only: registra los correos que habría enviado
// pero no abre conexión. Útil para desarrollo y pruebas.
type ConfigSMTP struct {
	Host       string
	Puerto     int
	Usuario    string
	Contrasena string
	Remitente  string
	StartTLS   bool
	LogOnly    bool
}

// ConfigSMTPDesdeEnv construye la config a partir de variables de entorno.
func ConfigSMTPDesdeEnv() ConfigSMTP {
	puerto, _ := strconv.Atoi(strings.TrimSpace(os.Getenv(EnvSMTPPuerto)))
	startTLS := true
	if v := strings.ToLower(strings.TrimSpace(os.Getenv(EnvSMTPStartTLS))); v == "0" || v == "false" || v == "no" {
		startTLS = false
	}
	logOnly := false
	if v := strings.ToLower(strings.TrimSpace(os.Getenv(EnvSMTPModoLog))); v == "1" || v == "true" || v == "yes" {
		logOnly = true
	}
	return ConfigSMTP{
		Host:       strings.TrimSpace(os.Getenv(EnvSMTPHost)),
		Puerto:     puerto,
		Usuario:    strings.TrimSpace(os.Getenv(EnvSMTPUsuario)),
		Contrasena: os.Getenv(EnvSMTPPassword),
		Remitente:  strings.TrimSpace(os.Getenv(EnvSMTPRemitente)),
		StartTLS:   startTLS,
		LogOnly:    logOnly,
	}
}

// CanalEmail implementa CanalSalida para SMTP.
type CanalEmail struct {
	cfg ConfigSMTP
}

// NuevoCanalEmail crea un canal SMTP. Si la config no tiene host, el canal
// arranca en modo log-only para que el resto del sistema siga funcionando.
func NuevoCanalEmail(cfg ConfigSMTP) *CanalEmail {
	if strings.TrimSpace(cfg.Host) == "" {
		cfg.LogOnly = true
	}
	if cfg.Puerto == 0 {
		cfg.Puerto = 587
	}
	if strings.TrimSpace(cfg.Remitente) == "" {
		cfg.Remitente = "noreply@campuschain.local"
	}
	return &CanalEmail{cfg: cfg}
}

// Nombre identifica el canal.
func (*CanalEmail) Nombre() string { return "email" }

// Entregar envía un correo a los destinatarios del Destino. En modo log-only
// solo registra el correo en el log (útil para dev y pruebas).
func (c *CanalEmail) Entregar(ctx context.Context, ev EventoNotificacion, dest tenants.DestinoNotificacion) error {
	if len(dest.Destinatarios) == 0 {
		return errors.New("destino email sin destinatarios")
	}
	asunto := strings.TrimSpace(dest.Asunto)
	if asunto == "" {
		asunto = fmt.Sprintf("[%s] %s — %s", strings.ToUpper(ev.Tenant), ev.Tipo, ev.Recurso)
	} else {
		asunto = expandirPlantilla(asunto, ev)
	}
	cuerpo := construirCuerpoCorreo(ev)

	if c.cfg.LogOnly {
		log.Printf(
			"[NOTIFICADOR_EMAIL][log-only] de=%s a=%v asunto=%q\n%s",
			c.cfg.Remitente, dest.Destinatarios, asunto, cuerpo,
		)
		return nil
	}

	mensaje := construirMensaje(c.cfg.Remitente, dest.Destinatarios, asunto, cuerpo)
	servidor := fmt.Sprintf("%s:%d", c.cfg.Host, c.cfg.Puerto)

	// Conexión TCP con timeout respetando el contexto.
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", servidor)
	if err != nil {
		return fmt.Errorf("conectar SMTP %s: %w", servidor, err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, c.cfg.Host)
	if err != nil {
		return fmt.Errorf("handshake SMTP: %w", err)
	}
	defer client.Close()

	if c.cfg.StartTLS {
		if err := client.StartTLS(&tls.Config{ServerName: c.cfg.Host}); err != nil {
			return fmt.Errorf("STARTTLS: %w", err)
		}
	}
	if c.cfg.Usuario != "" {
		auth := smtp.PlainAuth("", c.cfg.Usuario, c.cfg.Contrasena, c.cfg.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("autenticar SMTP: %w", err)
		}
	}
	if err := client.Mail(c.cfg.Remitente); err != nil {
		return fmt.Errorf("MAIL FROM: %w", err)
	}
	for _, dst := range dest.Destinatarios {
		if err := client.Rcpt(strings.TrimSpace(dst)); err != nil {
			return fmt.Errorf("RCPT TO %s: %w", dst, err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("DATA: %w", err)
	}
	if _, err := w.Write([]byte(mensaje)); err != nil {
		return fmt.Errorf("escribir DATA: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("cerrar DATA: %w", err)
	}
	return client.Quit()
}

func construirCuerpoCorreo(ev EventoNotificacion) string {
	var b strings.Builder
	b.WriteString("Se detectó una modificación auditable en CampusChain.\n\n")
	fmt.Fprintf(&b, "Tenant:    %s\n", ev.Tenant)
	fmt.Fprintf(&b, "Evento:    %s\n", ev.Tipo)
	if ev.Recurso != "" {
		fmt.Fprintf(&b, "Recurso:   %s\n", ev.Recurso)
	}
	fmt.Fprintf(&b, "Cuando:    %s\n", ev.Timestamp.Format(time.RFC3339))
	if ev.ActorNombre != "" || ev.ActorRol != "" || ev.ActorID != "" {
		fmt.Fprintf(&b, "Actor:     %s (rol=%s, id=%s)\n", ev.ActorNombre, ev.ActorRol, ev.ActorID)
	}
	if ev.TxID != "" {
		fmt.Fprintf(&b, "TxID:      %s\n", ev.TxID)
	}
	if ev.Resumen != "" {
		fmt.Fprintf(&b, "\nResumen:\n  %s\n", ev.Resumen)
	}
	b.WriteString("\nRevise el panel de administración para más detalles.\n")
	return b.String()
}

func construirMensaje(remitente string, destinatarios []string, asunto, cuerpo string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", remitente)
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(destinatarios, ", "))
	fmt.Fprintf(&b, "Subject: %s\r\n", asunto)
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	b.WriteString("\r\n")
	b.WriteString(cuerpo)
	return b.String()
}

func expandirPlantilla(plantilla string, ev EventoNotificacion) string {
	s := plantilla
	s = strings.ReplaceAll(s, "{tenant}", ev.Tenant)
	s = strings.ReplaceAll(s, "{tipo}", ev.Tipo)
	s = strings.ReplaceAll(s, "{recurso}", ev.Recurso)
	s = strings.ReplaceAll(s, "{actor}", ev.ActorNombre)
	s = strings.ReplaceAll(s, "{rol}", ev.ActorRol)
	return s
}
