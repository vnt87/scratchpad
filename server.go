package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
)

//go:embed dist/*
var distFS embed.FS

const maxTextBytes = 200_000

type Broadcaster struct {
	mu      sync.RWMutex
	text    string
	clients map[chan string]struct{}
}

func newBroadcaster() *Broadcaster {
	return &Broadcaster{
		clients: make(map[chan string]struct{}),
	}
}

func (b *Broadcaster) addClient() (chan string, string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan string, 16)
	b.clients[ch] = struct{}{}
	return ch, b.text
}

func (b *Broadcaster) removeClient(ch chan string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.clients, ch)
	close(ch)
}

func (b *Broadcaster) setText(newText string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.text = newText
	for ch := range b.clients {
		select {
		case ch <- newText:
		default:
		}
	}
}

func formatSSEFrame(text string) string {
	payload, _ := json.Marshal(map[string]string{"text": text})
	return fmt.Sprintf("data: %s\n\n", payload)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	distSub, err := fs.Sub(distFS, "dist")
	if err != nil {
		log.Fatalf("failed to load dist fs: %v", err)
	}

	b := newBroadcaster()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusMethodNotAllowed)
			w.Write([]byte("method_not_allowed"))
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		ch, initial := b.addClient()
		defer b.removeClient(ch)

		w.Write([]byte(formatSSEFrame(initial)))
		flusher.Flush()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				w.Write([]byte(formatSSEFrame(msg)))
				flusher.Flush()
			}
		}
	})

	mux.HandleFunc("/api/text", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusMethodNotAllowed)
			w.Write([]byte("method_not_allowed"))
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxTextBytes+1))
		if err != nil {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("bad_request"))
			return
		}
		if len(body) > maxTextBytes {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			w.Write([]byte("too_large"))
			return
		}

		b.setText(string(body))
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusMethodNotAllowed)
			w.Write([]byte("method_not_allowed"))
			return
		}

		urlPath := path.Clean(r.URL.Path)
		if urlPath == "/" {
			urlPath = "index.html"
		} else {
			urlPath = strings.TrimPrefix(urlPath, "/")
		}

		data, err := fs.ReadFile(distSub, urlPath)
		if err != nil {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("not_found"))
			return
		}

		ext := filepath.Ext(urlPath)
		ctype := mime.TypeByExtension(ext)
		if ctype == "" {
			switch ext {
			case ".html":
				ctype = "text/html; charset=utf-8"
			case ".js":
				ctype = "text/javascript; charset=utf-8"
			case ".css":
				ctype = "text/css; charset=utf-8"
			case ".json":
				ctype = "application/json; charset=utf-8"
			case ".svg":
				ctype = "image/svg+xml"
			case ".webp":
				ctype = "image/webp"
			case ".woff2":
				ctype = "font/woff2"
			case ".woff":
				ctype = "font/woff"
			case ".ico":
				ctype = "image/x-icon"
			default:
				ctype = "application/octet-stream"
			}
		}

		w.Header().Set("Content-Type", ctype)
		if urlPath == "index.html" {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}

		if r.Method == http.MethodGet {
			w.Write(data)
		}
	})

	log.Printf("ScratchPad listening on http://0.0.0.0:%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
