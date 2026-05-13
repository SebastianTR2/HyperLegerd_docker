package handlers

import "strings"

// mensajeDetalleFabric intenta extraer el texto devuelto por el chaincode o por el peer,
// en lugar de solo el envoltorio de error del cliente gRPC.
func mensajeDetalleFabric(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	seps := []string{
		"chaincode return message: ",
		"ChaincodeResponseMessage: ",
		"chaincode response message: ",
		"transaction returned failure: ",
		"endorsement failure during invoke. could not invoke:",
	}
	for _, sep := range seps {
		if i := strings.Index(msg, sep); i >= 0 {
			rest := strings.TrimSpace(msg[i+len(sep):])
			if rest != "" {
				return rest
			}
		}
	}
	return msg
}
