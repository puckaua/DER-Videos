/**
 * pages/index.js
 *
 * Página principal do OneDrive Video Viewer.
 * Gerencia autenticação, navegação por pastas e reprodução de vídeos.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

// ─── Utilitários ────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getItemIcon(type) {
  if (type === "folder") return "📁";
  if (type === "video")  return "🎬";
  return "📄";
}

// ─── Componente: Ícone Microsoft ─────────────────────────────────────────────

function MicrosoftLogo() {
  return (
    <svg className="ms-logo" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

// ─── Componente: VideoPlayer Modal ───────────────────────────────────────────

function VideoModal({ video, onClose }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  // Fecha ao pressionar Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Busca URL fresca do vídeo
  useEffect(() => {
    if (!video) return;

    async function fetchVideoUrl() {
      setLoading(true);
      setError(null);
      try {
        // Se já temos a downloadUrl e ela é recente, usa diretamente
        if (video.downloadUrl) {
          setVideoUrl(video.downloadUrl);
          setLoading(false);
          return;
        }

        // Caso contrário, busca uma URL fresca via API
        const res = await fetch(
          `/api/video-url?driveId=${encodeURIComponent(video.driveId)}&itemId=${encodeURIComponent(video.id)}`
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Erro ao carregar vídeo");
        setVideoUrl(data.downloadUrl);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchVideoUrl();
  }, [video]);

  if (!video) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Reproduzindo: ${video.name}`}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{video.name}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar player"
          >
            ×
          </button>
        </div>

        <div className="video-wrapper">
          {loading && (
            <div className="video-loading">
              <div className="spinner" />
              <span>Carregando vídeo…</span>
            </div>
          )}

          {error && (
            <div className="video-loading">
              <span style={{ fontSize: 32 }}>⚠️</span>
              <span style={{ color: "#FCA5A5" }}>{error}</span>
              <button
                className="btn btn-ghost"
                onClick={() => { setError(null); setLoading(true); }}
                style={{ marginTop: 8 }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {videoUrl && !loading && !error && (
            <video
              ref={videoRef}
              className="video-player"
              controls
              autoPlay
              src={videoUrl}
              onError={() => setError("Erro ao reproduzir o vídeo. A URL pode ter expirado.")}
            >
              Seu navegador não suporta a reprodução de vídeo.
            </video>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente: Item Card ────────────────────────────────────────────────────

function ItemCard({ item, onClick }) {
  return (
    <button
      className="item-card"
      onClick={() => onClick(item)}
      aria-label={`${item.type === "folder" ? "Abrir pasta" : item.type === "video" ? "Reproduzir vídeo" : "Arquivo"}: ${item.name}`}
    >
      <div className={`item-card-icon ${item.type}`}>
        {getItemIcon(item.type)}
      </div>

      <div>
        <div className={`item-type-badge badge-${item.type}`}>
          {item.type === "folder" ? "PASTA" : item.type === "video" ? "VÍDEO" : "ARQUIVO"}
        </div>
        <div className="item-card-name">{item.name}</div>
      </div>

      <div className="item-card-meta">
        {item.type === "folder" && item.childCount != null
          ? `${item.childCount} ite${item.childCount === 1 ? "m" : "ns"}`
          : formatSize(item.size)}
      </div>
    </button>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function Home() {
  const [authenticated, setAuthenticated] = useState(null); // null = verificando
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  // Pilha de navegação: cada entrada é { id, driveId, name }
  // Raiz = [], entrada compartilhada = [{ id: "root", driveId: null, name: "Compartilhados" }]
  const [navStack, setNavStack] = useState([]);

  // ── Verificação de autenticação ──────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        setAuthenticated(data.authenticated);
      } catch {
        setAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  // ── Carrega itens quando autenticado ou navegação muda ───────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      let res, data;

      if (navStack.length === 0) {
        // Raiz: lista compartilhados
        res = await fetch("/api/shared");
        data = await res.json();
      } else {
        // Dentro de uma pasta
        const current = navStack[navStack.length - 1];
        res = await fetch(
          `/api/children?driveId=${encodeURIComponent(current.driveId)}&itemId=${encodeURIComponent(current.id)}`
        );
        data = await res.json();
      }

      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        throw new Error(data.error || "Erro ao carregar itens");
      }

      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navStack]);

  useEffect(() => {
    if (authenticated) loadItems();
  }, [authenticated, loadItems]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleItemClick(item) {
    if (item.type === "folder") {
      setNavStack((prev) => [
        ...prev,
        {
          id: item.remoteItemId || item.id,
          driveId: item.driveId,
          name: item.name,
        },
      ]);
    } else if (item.type === "video") {
      setPlayingVideo(item);
    }
    // Arquivos não-vídeo: ignora por ora
  }

  function handleBreadcrumbClick(index) {
    // index -1 = voltar para raiz
    setNavStack((prev) => prev.slice(0, index + 1));
  }

  // ── Render: Verificando autenticação ─────────────────────────────────────
  if (authenticated === null) {
    return (
      <>
        <Head>
          <title>OneDrive Vídeos</title>
        </Head>
        <div className="app-container">
          <div className="loading-state" style={{ flex: 1, height: "100vh" }}>
            <div className="spinner" />
            <span>Verificando sessão…</span>
          </div>
        </div>
      </>
    );
  }

  // ── Render: Tela de Login ────────────────────────────────────────────────
  if (!authenticated) {
    const loginError = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("error")
      : null;

    return (
      <>
        <Head>
          <title>OneDrive Vídeos — Login</title>
          <meta name="description" content="Acesse seus vídeos compartilhados no OneDrive" />
        </Head>
        <div className="app-container">
          <header className="header">
            <div className="header-logo">
              <div className="header-logo-icon">🎬</div>
              OneDrive Vídeos
            </div>
          </header>

          <main className="login-screen">
            <div className="login-icon">🎬</div>
            <h1 className="login-title">OneDrive Vídeos</h1>
            <p className="login-subtitle">
              Acesse e assista seus vídeos compartilhados no OneDrive
              diretamente no navegador, sem precisar baixar nada.
            </p>

            {loginError && (
              <div className="error-banner" style={{ marginBottom: 24, maxWidth: 420 }}>
                ⚠️ {decodeURIComponent(loginError)}
              </div>
            )}

            <a href="/api/auth/login">
              <button className="login-btn-ms">
                <MicrosoftLogo />
                Entrar com conta Microsoft
              </button>
            </a>

            <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)", maxWidth: 360 }}>
              Suas credenciais são gerenciadas pela Microsoft. Este app
              solicita apenas permissão de leitura dos seus arquivos.
            </p>
          </main>
        </div>
      </>
    );
  }

  // ── Render: App Principal ────────────────────────────────────────────────
  const currentName =
    navStack.length === 0
      ? "Compartilhados comigo"
      : navStack[navStack.length - 1].name;

  const videoCount = items.filter((i) => i.type === "video").length;
  const folderCount = items.filter((i) => i.type === "folder").length;

  return (
    <>
      <Head>
        <title>
          {navStack.length > 0 ? `${currentName} — OneDrive Vídeos` : "OneDrive Vídeos"}
        </title>
      </Head>

      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <div className="header-logo-icon">🎬</div>
            OneDrive Vídeos
          </div>
          <div className="header-actions">
            <button
              className="btn btn-ghost"
              onClick={loadItems}
              disabled={loading}
              aria-label="Atualizar lista"
            >
              {loading ? "⟳" : "↺"} Atualizar
            </button>
            <a href="/api/auth/logout">
              <button className="btn btn-danger">Sair</button>
            </a>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="main-content">

          {/* Breadcrumb */}
          <nav className="breadcrumb" aria-label="Navegação de pastas">
            <div className={`breadcrumb-item ${navStack.length === 0 ? "active" : ""}`}>
              {navStack.length === 0 ? (
                <span>🏠 Início</span>
              ) : (
                <button onClick={() => handleBreadcrumbClick(-1)}>🏠 Início</button>
              )}
            </div>

            {navStack.map((entry, i) => (
              <div key={`${entry.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="breadcrumb-sep">›</span>
                <div className={`breadcrumb-item ${i === navStack.length - 1 ? "active" : ""}`}>
                  {i < navStack.length - 1 ? (
                    <button onClick={() => handleBreadcrumbClick(i)}>
                      {entry.name}
                    </button>
                  ) : (
                    <span>{entry.name}</span>
                  )}
                </div>
              </div>
            ))}
          </nav>

          {/* Erro */}
          {error && !loading && (
            <div className="error-banner">
              ⚠️ {error}
              <button
                className="btn btn-ghost"
                onClick={loadItems}
                style={{ marginLeft: "auto", flexShrink: 0 }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <span>Carregando {navStack.length === 0 ? "itens compartilhados" : `"${currentName}"`}…</span>
            </div>
          )}

          {/* Itens */}
          {!loading && !error && (
            <>
              {items.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-title">Nenhum item encontrado</div>
                  <div className="empty-sub">
                    {navStack.length === 0
                      ? "Não há arquivos ou pastas compartilhados com você ainda."
                      : "Esta pasta está vazia."}
                  </div>
                </div>
              ) : (
                <>
                  <div className="section-header">
                    <span className="section-title">
                      {navStack.length === 0 ? "Compartilhados comigo" : currentName}
                    </span>
                    <span className="item-count">
                      {folderCount > 0 && `${folderCount} pasta${folderCount !== 1 ? "s" : ""}`}
                      {folderCount > 0 && videoCount > 0 && " · "}
                      {videoCount > 0 && `${videoCount} vídeo${videoCount !== 1 ? "s" : ""}`}
                      {folderCount === 0 && videoCount === 0 && `${items.length} ite${items.length !== 1 ? "ns" : "m"}`}
                    </span>
                  </div>

                  <div className="items-grid">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onClick={handleItemClick}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de vídeo */}
      {playingVideo && (
        <VideoModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}
    </>
  );
}
