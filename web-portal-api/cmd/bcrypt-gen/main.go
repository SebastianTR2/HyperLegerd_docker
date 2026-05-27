// bcrypt-gen es un helper para generar hashes bcrypt para
// config/usuarios-admin.yaml.
//
//   go run ./cmd/bcrypt-gen "mi-contraseña"
//
// Si no se pasa argumento, lee la contraseña por stdin.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	var pwd string
	if len(os.Args) >= 2 {
		pwd = strings.Join(os.Args[1:], " ")
	} else {
		fmt.Fprint(os.Stderr, "Contraseña: ")
		r := bufio.NewReader(os.Stdin)
		linea, _ := r.ReadString('\n')
		pwd = strings.TrimRight(linea, "\r\n")
	}
	if pwd == "" {
		fmt.Fprintln(os.Stderr, "Contraseña vacía. Uso: bcrypt-gen <contraseña>")
		os.Exit(2)
	}
	h, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
	fmt.Println(string(h))
}
