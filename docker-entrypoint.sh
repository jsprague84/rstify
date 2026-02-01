#!/bin/sh
# Fix ownership of data directories when mounted volumes are owned by root
# This handles the transition from the old root-based image
if [ "$(id -u)" = "0" ]; then
    chown -R rstify:rstify /data /uploads 2>/dev/null || true
    exec gosu rstify "$@"
else
    exec "$@"
fi
