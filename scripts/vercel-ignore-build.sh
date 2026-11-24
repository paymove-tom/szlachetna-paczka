#!/usr/bin/env bash
# Vercel: kod 0 pomija build, kod 1 buduje.
# Same commity z data/zapisy.json (zapisy rodziców) nie przebudowują strony.
set -eu

if ! git rev-parse --verify --quiet 'HEAD^' >/dev/null; then
  echo "Brak poprzedniego commita — buduję."
  exit 1
fi

if git diff --quiet 'HEAD^' HEAD -- . ':!data/zapisy.json'; then
  echo "Tylko data/zapisy.json — pomijam redeploy."
  exit 0
fi

echo "Są zmiany poza data/zapisy.json — buduję."
exit 1
