package models

type User struct {
	ID             string `json:"id"`
	Username       string `json:"username"`
	NombreCompleto string `json:"nombreCompleto"`
	Rol            string `json:"rol"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Ok      bool   `json:"ok"`
	Token   string `json:"token"`
	Usuario User   `json:"usuario"`
}

type MeResponse struct {
	Ok      bool `json:"ok"`
	Usuario User `json:"usuario"`
}

type ErrorResponse struct {
	Ok      bool   `json:"ok"`
	Codigo  string `json:"codigo,omitempty"`
	Mensaje string `json:"mensaje"`
}
