# ============================================================
#  Terminal web (ttyd + UI kustom ramah layar sentuh)
#  Cocok untuk Koyeb / Fly.io / VPS / Docker lokal.
#
#  Build : docker build -t terminal-web .
#  Run   : docker run --rm -p 8000:8000 -e TERM_USER=admin \
#            -e TERM_PASS=rahasia terminal-web
# ============================================================

# --- tahap 1: gabungkan CSS/JS ke satu halaman (ttyd hanya menyajikan 1 file) ---
FROM python:3.12-slim AS build
WORKDIR /src
COPY web/ web/
COPY tools/build_index.py tools/build_index.py
RUN python3 tools/build_index.py --web web --out /out/index.html

# --- tahap 2: runtime ---
FROM debian:bookworm-slim

ARG TTYD_VERSION=1.7.7

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PORT=8000

# paket dasar supaya terminalnya benar-benar bisa dipakai
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash ca-certificates curl wget git sudo \
      less nano vim-tiny tmux screen \
      procps htop tree \
      python3 python3-pip \
      tar unzip zip xz-utils jq \
      openssh-client iputils-ping dnsutils iproute2 netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

# ttyd (server terminal) — arsitektur mengikuti mesin build
RUN set -eux; \
    case "$(uname -m)" in \
      x86_64|amd64)  arch=x86_64  ;; \
      aarch64|arm64) arch=aarch64 ;; \
      *) echo "arsitektur tidak didukung: $(uname -m)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /usr/local/bin/ttyd \
      "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${arch}"; \
    chmod 0755 /usr/local/bin/ttyd; \
    ttyd --version

# user non-root
RUN useradd --create-home --shell /bin/bash --uid 1000 dev \
 && echo 'dev ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/dev \
 && chmod 0440 /etc/sudoers.d/dev

COPY --from=build /out/index.html /opt/ttyd/index.html
COPY start.sh /usr/local/bin/start.sh
COPY bashrc /home/dev/.bashrc
COPY tmux.conf /home/dev/.tmux.conf
RUN chmod 0755 /usr/local/bin/start.sh \
 && chown dev:dev /home/dev/.bashrc /home/dev/.tmux.conf

USER dev
WORKDIR /home/dev

EXPOSE 8000

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/${PORT:-8000}' || exit 1

CMD ["/usr/local/bin/start.sh"]
