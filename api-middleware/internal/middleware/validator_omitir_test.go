package middleware

import "testing"

func TestOmitirValidacionOpenAPI(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/auditoria/combinada", true},
		{"/auditoria/http", true},
		{"//auditoria/combinada", true},
		{"/api/auditoria/combinada", true},
		{"/api/auditoria/http", true},
		{"/admin/foo", true},
		{"/clientes", false},
		{"/api/clientes", false},
		{"/foo/auditoria/x", false},
		{"/eventos/historial", false},
	}
	for _, tc := range cases {
		if got := omitirValidacionOpenAPI(tc.path); got != tc.want {
			t.Fatalf("%q: got %v want %v", tc.path, got, tc.want)
		}
	}
}
