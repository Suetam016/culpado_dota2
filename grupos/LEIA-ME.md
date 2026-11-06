# Grupos da Liga

O Marocas (grupo fundador) usa `amigos.json` e `amigos/` na raiz. Cada outro grupo tem uma pasta aqui:

- `grupos.json`: a lista dos grupos (id, nome, data em que entrou). A Liga dos grupos (/ranking/) lê esta lista.
- `<id>/amigos.json`: as contas do grupo (`{"conta": "nome"}`), escrito na mão a partir do pedido.
- `<id>/ranking.json` e `<id>/parceiros.json`: gerados pelo robô do ranking (`GRUPO=<id> node ranking/gerar.js` e
  `python ranking/parceiros.py --grupo <id>`).

A página de um grupo é `/ranking/?grupo=<id>` (sem `?grupo` é o Marocas). A coleta junta as contas de todos os grupos
na lista manual, então as partidas deles entram na base sozinhas; o ranking aparece depois da primeira coleta.

## Entrada de um grupo (onboarding)

1. Crie `<id>/amigos.json` e ponha a linha em `grupos.json` (opcional: `"papel": "KSH3"`, o código da ação na Bolsa;
   sem ele sai das consoantes do nome). Merge na main.
2. O merge dispara a coleta: ela baixa as partidas dos últimos 14 dias de cada integrante (a última semana inteira
   entra aqui) e, com a sobra da cota, o histórico mais antigo. Partida recente que o OpenDota ainda não analisou fica
   em `provisorias/` e a coleta pede a análise do replay.
3. O ranking roda depois da coleta: foto da Steam e medalha de cada um (perfis), culpados e craques das partidas já
   analisadas. As que esperam a análise aparecem no site como "partidas recentes ainda esperam a análise".
4. A análise do OpenDota costuma sair em minutos ou poucas horas; a coleta volta a olhar a cada rodada. Como o
   agendamento do GitHub pula rodadas, para acelerar a entrada de um grupo dá para disparar a coleta com um push em
   `coleta/disparar` (qualquer conteúdo).

## E-mail de quem pediu

O formulário da Liga aceita um e-mail opcional para avisar quando a página do grupo subir. Como `feedback/` é público,
o navegador cifra o e-mail (RSA-OAEP SHA-256, chave pública `CHAVE_EMAILS` em `ranking/app.js`) e o pedido traz só a
linha `E-mail para avisar (cifrado): <base64>`. A chave privada fica fora do repositório (pasta privada do projeto).
Para abrir:

    echo '<base64>' | base64 -d | openssl pkeyutl -decrypt -inkey emails-grupos.pem \
      -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256
