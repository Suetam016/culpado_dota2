# Grupos da Liga

O Marocas (grupo fundador) usa `amigos.json` e `amigos/` na raiz. Cada outro grupo tem uma pasta aqui:

- `grupos.json`: a lista dos grupos (id, nome, data em que entrou). A Liga dos grupos (/ranking/) lê esta lista.
- `<id>/amigos.json`: as contas do grupo (`{"conta": "nome"}`), escrito na mão a partir do pedido.
- `<id>/ranking.json` e `<id>/parceiros.json`: gerados pelo robô do ranking (`GRUPO=<id> node ranking/gerar.js` e
  `python ranking/parceiros.py --grupo <id>`).

A página de um grupo é `/ranking/?grupo=<id>` (sem `?grupo` é o Marocas). A coleta junta as contas de todos os grupos
na lista manual, então as partidas deles entram na base sozinhas; o ranking aparece depois da primeira coleta.

Para incluir um grupo: crie `<id>/amigos.json`, ponha a linha em `grupos.json` e faça merge na main.

## E-mail de quem pediu

O formulário da Liga aceita um e-mail opcional para avisar quando a página do grupo subir. Como `feedback/` é público,
o navegador cifra o e-mail (RSA-OAEP SHA-256, chave pública `CHAVE_EMAILS` em `ranking/app.js`) e o pedido traz só a
linha `E-mail para avisar (cifrado): <base64>`. A chave privada fica fora do repositório (pasta privada do projeto).
Para abrir:

    echo '<base64>' | base64 -d | openssl pkeyutl -decrypt -inkey emails-grupos.pem \
      -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256
