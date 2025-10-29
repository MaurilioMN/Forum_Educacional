package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func TestSignupRoute(t *testing.T) {
	url := "http://localhost:3000/api/auth/signup"

	payload := map[string]string{
		"username": "users122",
		"email":    "magalhaes.neto@gmail.com",
		"password": "senha123",
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Erro ao enviar requisição: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		t.Fatalf("Status inesperado: %d — corpo: %s", resp.StatusCode, string(body))
	}

	// Lê o JSON de resposta
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		t.Fatalf("Erro ao decodificar JSON: %v", err)
	}

	// Caso a API retorne erro
	if val, ok := data["error"]; ok {
		t.Errorf("Erro retornado pela API: %v", val)
	}

	t.Logf("Resposta da API: %+v", data)
}
