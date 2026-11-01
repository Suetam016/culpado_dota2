#!/usr/bin/env bash
# Branch órfão "dados" (a base de partidas do robô da coleta): baixa antes da rodada e salva depois.
#
#   bash coleta/dados.sh preparar <pasta>              clona o branch só com os arquivos da raiz (partidas/ fica no
#                                                      GitHub: só cresce e o robô não precisa dele, o indice.json basta);
#                                                      se o branch ainda não existe, começa uma pasta vazia; no fim,
#                                                      testa se o push vai funcionar (git push --dry-run) e falha se
#                                                      não: sem push, a rodada gastaria cota e perderia tudo (até o
#                                                      contador de consultas do estado.json)
#   bash coleta/dados.sh salvar <pasta> "<mensagem>"   commit do que a rodada gravou e push; se o branch andou nesse
#                                                      meio-tempo, pull --rebase e tenta de novo. Nunca apaga arquivo.
#
# DADOS_REMOTO: endereço do repositório (padrão: o origin do repositório atual); DADOS_BRANCH (padrão: dados);
# GH_TOKEN: no GitHub Actions, o github.token do workflow (para clonar e enviar).
set -euo pipefail

acao="${1:?uso: dados.sh preparar|salvar <pasta> [mensagem]}"
pasta="${2:?uso: dados.sh preparar|salvar <pasta> [mensagem]}"
branch="${DADOS_BRANCH:-dados}"

cabecalho=""
if [ -n "${GH_TOKEN:-}" ]; then
  b64="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
  [ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$b64"
  cabecalho="AUTHORIZATION: basic $b64"
fi

git_auth() {
  if [ -n "$cabecalho" ]; then
    git -c "http.https://github.com/.extraheader=$cabecalho" "$@"
  else
    git "$@"
  fi
}

preparar() {
  local remoto="${DADOS_REMOTO:-$(git remote get-url origin)}"
  if [ -e "$pasta/.git" ]; then
    echo "a pasta $pasta já tem um repositório"
    exit 1
  fi
  local existe=0
  git_auth ls-remote --exit-code --heads "$remoto" "$branch" > /dev/null || existe=$?
  if [ "$existe" = 0 ]; then
    # --sparse: só os arquivos da raiz; --filter=blob:none: os .json.gz das partidas nem são baixados
    git_auth clone --quiet --depth 1 --branch "$branch" --single-branch --filter=blob:none --sparse "$remoto" "$pasta"
    echo "branch $branch: $(git -C "$pasta" log -1 --format='%h %s (%ci)')"
    echo "partidas no branch: $(git -C "$pasta" ls-tree --name-only HEAD partidas/ | wc -l)"
  elif [ "$existe" = 2 ]; then
    git init --quiet -b "$branch" "$pasta"
    git -C "$pasta" remote add origin "$remoto"
    echo "o branch $branch ainda não existe: começa vazio (esta rodada cria)"
  else
    echo "não consegui consultar $remoto (git ls-remote saiu com $existe)"
    exit 1
  fi
  if [ -n "$cabecalho" ]; then
    git -C "$pasta" config "http.https://github.com/.extraheader" "$cabecalho"
  fi
  # o push vai funcionar? (credencial com escrita; não pega regra de branch, só o push de verdade pega)
  local alvo="HEAD"
  if ! git -C "$pasta" rev-parse --verify --quiet HEAD > /dev/null; then
    # branch novo, sem commit: testa com um commit vazio solto (não entra em branch nenhum e não é enviado)
    local vazia
    vazia="$(git -C "$pasta" hash-object -t tree -w /dev/null)"
    alvo="$(git -C "$pasta" -c user.name=coleta -c user.email=coleta@localhost commit-tree "$vazia" -m teste)"
  fi
  if ! git -C "$pasta" push --dry-run --quiet origin "$alvo:refs/heads/$branch"; then
    echo "não consigo enviar para o branch $branch (permissão? contents: write no workflow): sem coleta nesta rodada"
    exit 1
  fi
  echo "push para o branch $branch: ok (teste sem enviar nada)"
}

salvar() {
  local msg="${3:-Coleta de partidas}"
  cd "$pasta"
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  local alvos=()
  for f in partidas provisorias visitas indice.json estado.json amigos.json README.md; do
    [ -e "$f" ] && alvos+=("$f")
  done
  if [ ${#alvos[@]} -eq 0 ]; then
    echo "nada para salvar"
    return 0
  fi
  # --ignore-removal: nunca registra arquivo apagado; --sparse: deixa acrescentar em partidas/ e provisorias/ (fora do checkout)
  git add --sparse --ignore-removal -- "${alvos[@]}"
  if git diff --cached --quiet; then
    echo "nada novo para salvar"
    return 0
  fi
  git commit --quiet -m "$msg"
  for i in 1 2 3 4 5; do
    if git push --quiet origin "HEAD:refs/heads/$branch"; then
      echo "salvo no branch $branch: $(git log -1 --format='%h') ($(git show --name-only --format= HEAD | grep -c '^partidas/' || true) arquivos de partida no commit)"
      return 0
    fi
    echo "push recusado (tentativa $i): o branch andou; pull --rebase e de novo"
    if git pull --quiet --rebase -X theirs origin "$branch"; then
      :
    else
      git rebase --abort 2>/dev/null || true
    fi
    sleep $((i * 3))
  done
  echo "não consegui enviar para o branch $branch"
  exit 1
}

case "$acao" in
  preparar) preparar ;;
  salvar) salvar "$@" ;;
  *) echo "ação desconhecida: $acao (use preparar ou salvar)"; exit 1 ;;
esac
