#!/bin/sh
set -e

# Substitute environment variables in nginx config template
envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
