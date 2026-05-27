/*
SPDX-License-Identifier: Apache-2.0
*/

package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
	"github.com/hyperledger/fabric-samples/dato-cc/chaincode-go/chaincode"
)

func main() {
	datoChaincode, err := contractapi.NewChaincode(&chaincode.SmartContract{})
	if err != nil {
		log.Panicf("Error creating dato_cc chaincode: %v", err)
	}

	if err := datoChaincode.Start(); err != nil {
		log.Panicf("Error starting dato_cc chaincode: %v", err)
	}
}
