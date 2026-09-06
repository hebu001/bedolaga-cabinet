#!/bin/sh
set -eu

# This script runs after the official nginx image entrypoint setup.
# Keep a separate output path to allow unprivileged syntax/runtime smoke tests.
cabinet_output=${CABINET_API_CONFIG:-/etc/nginx/cabinet-api.conf}
cabinet_origin=${CABINET_BACKEND_ORIGIN:-}
cabinet_origin=${cabinet_origin%/}

if [ -z "$cabinet_origin" ]; then
    cat > "$cabinet_output" <<'CONFIG'
location = /api {
    types { }
    default_type application/json;
    add_header Cache-Control "no-store" always;
    return 503 '{"detail":"Cabinet backend is not configured"}';
}
location ^~ /api/ {
    types { }
    default_type application/json;
    add_header Cache-Control "no-store" always;
    return 503 '{"detail":"Cabinet backend is not configured"}';
}
CONFIG
    exit 0
fi

case "$cabinet_origin" in
    *[[:space:]]*)
        printf '%s\n' 'CABINET_BACKEND_ORIGIN must be an http(s) origin without credentials, path or query.' >&2
        exit 1
        ;;
esac

# An origin only, never a path, credentials, query or nginx configuration text.
if ! printf '%s\n' "$cabinet_origin" | grep -Eq '^https?://([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(:[0-9]{1,5})?$'; then
    printf '%s\n' 'CABINET_BACKEND_ORIGIN must be an http(s) origin without credentials, path or query.' >&2
    exit 1
fi
cabinet_host=${cabinet_origin#*://}
case "$cabinet_host" in
    \[*) cabinet_tls_name=${cabinet_host%%\]*}; cabinet_tls_name=${cabinet_tls_name#\[} ;;
    *) cabinet_tls_name=${cabinet_host%%:*} ;;
esac

cat > "$cabinet_output" <<CONFIG
location = /api {
    return 308 /api/\$is_args\$args;
}
location ^~ /api/ {
    # The trailing slash removes /api/ while preserving the remaining path/query.
    proxy_pass $cabinet_origin/;
    proxy_http_version 1.1;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$cabinet_connection_upgrade;
    proxy_read_timeout 75s;
    proxy_send_timeout 75s;
    proxy_connect_timeout 10s;
    proxy_buffering off;
    proxy_cache off;
    proxy_ssl_server_name on;
    proxy_ssl_name $cabinet_tls_name;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_verify_depth 3;
    # Upstream errors can otherwise include sensitive request query strings.
    error_log /dev/stderr crit;
    add_header Cache-Control "no-store" always;
}
CONFIG
