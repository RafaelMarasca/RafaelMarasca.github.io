# Servidor do site (Cloudflare Worker)

Guarda a lista de presentes, os bilhetinhos publicados e os poemas escritos pelo site. É um arquivo só, [`worker.js`](worker.js), que roda de graça na Cloudflare com um banco D1. Não precisa instalar nada: tudo se faz pelo site da Cloudflare.

## Montar pela primeira vez (uns 15 minutos)

1. **Conta.** Crie uma conta gratuita em [dash.cloudflare.com](https://dash.cloudflare.com). Não precisa de cartão.
2. **Banco.** No menu, abra **Storage & Databases → D1 SQL Database → Create**. Nome: `lulu-e-rafo`. As tabelas são criadas sozinhas depois.
3. **Worker.**
   1. Abra **Compute (Workers) → Workers & Pages → Create → Start with Hello World**.
   2. Nome: `lulu-e-rafo-api`. Clique em **Deploy**.
   3. Clique em **Edit code**, apague o exemplo e cole todo o conteúdo de `worker.js`. Clique em **Deploy** de novo.
4. **Ligar o banco.** No Worker, abra **Settings → Bindings → Add → D1 database**. Nome da variável: `DB`. Banco: `lulu-e-rafo`. Salve.
5. **Segredos.**
   1. Abra [rafaelmarasca.github.io/backend/gerar-segredos.html](https://rafaelmarasca.github.io/backend/gerar-segredos.html), digite a frase e clique em **Gerar**. A frase não sai do seu navegador.
   2. No Worker, abra **Settings → Variables and Secrets → Add**. Escolha o tipo **Secret** e crie dois:
      - `PHRASE_HASH` com o primeiro resultado;
      - `SESSION_SECRET` com o segundo.
   3. Clique em **Deploy** para aplicar.
6. **Endereço.** Na página do Worker aparece algo como `https://lulu-e-rafo-api.SEU-NOME.workers.dev`. Abra esse endereço com `/gifts` no fim: se aparecer *“Sua entrada terminou…”*, o servidor está no ar.
7. **Copiar os dados do servidor antigo.** Abra [rafaelmarasca.github.io/migrar.html](https://rafaelmarasca.github.io/migrar.html), cole o endereço do Worker, digite a frase e clique em **Copiar tudo**. Pode repetir sem duplicar nada.
   - Bilhetinhos agendados para depois de hoje não podem ser copiados: o servidor antigo não libera a imagem antes do dia. Publique de novo a partir do rascunho.
8. **Trocar o site para o servidor novo.** Em [`site-acesso.js`](../site-acesso.js), troque o endereço em `const api = ...` pelo do Worker e publique o site.

## Publicar uma nova versão do servidor

Abra o Worker → **Edit code**, cole o `worker.js` atualizado e clique em **Deploy**. Os dados ficam no banco e não são afetados.

Quem preferir o terminal pode usar `npx wrangler deploy` nesta pasta (precisa de Node.js). Antes, coloque o ID do banco em [`wrangler.toml`](wrangler.toml).

## Segurança

- **Frase:** a Cloudflare guarda só um *hash* salgado da frase, como segredo, fora do código. Maiúsculas e espaços extras não importam.
- **Tentativas erradas:** depois de 10 erros seguidos, aquele endereço de internet espera 15 minutos.
- **Entrada:** depois de digitar a frase, o aparelho recebe uma sessão assinada pelo servidor, que não pode ser falsificada sem o `SESSION_SECRET`.
  - Sem “lembrar”, vale 12 horas.
  - Com “lembrar”, vale 30 dias e se renova sozinha quando o site é usado. O aparelho guarda só a sessão, nunca a frase.
- **Origem:** o servidor só responde a páginas de `rafaelmarasca.github.io`. Para liberar outro endereço, crie a variável `ALLOWED_ORIGINS` com os endereços separados por vírgula.
- **Rascunhos:** os rascunhos dos bilhetinhos ficam só no navegador, cifrados com uma chave que o servidor entrega a quem entrou.
- **O que não fica protegido:** os poemas de `poemas-data.js` e o álbum continuam públicos no repositório do GitHub. Quem souber a frase vê e altera tudo; não há contas separadas.

## Tarefas de manutenção

- **Trocar a frase:** gere um novo `PHRASE_HASH` em `gerar-segredos.html` e substitua o segredo. As sessões atuais continuam valendo até expirar.
- **Tirar a entrada de todos os aparelhos:** troque o `SESSION_SECRET` por outro gerado na mesma página.
- **Começar do zero:** se a migração disser que a chave dos rascunhos já existe com outro valor, rode no console do D1 (**D1 → lulu-e-rafo → Console**):

  ```sql
  DELETE FROM settings WHERE key = 'draftKey';
  ```

  Depois, rode a migração de novo.
- **Ver os dados:** o console do D1 aceita SQL. Por exemplo, `SELECT date, title FROM notes ORDER BY date DESC;`

## API

Toda chamada, exceto `/unlock`, envia a sessão no cabeçalho `X-Gift-Session`. Para gravar ou excluir, envie também a versão atual em `X-Gift-Version`; use `new` para criar um presente.

| Método e caminho | O que faz |
| --- | --- |
| `POST /unlock` `{code, remember}` | Confere a frase e devolve `{session}` |
| `POST /session/renew` | Troca uma sessão lembrada por outra de 30 dias |
| `GET /gifts` | Lista os presentes, sem fotos |
| `GET /gifts/:id` | Um presente completo, com a foto |
| `PUT /gifts/:id` | Cria ou altera um presente (`X-Gift-Version`) |
| `DELETE /gifts/:id` | Exclui um presente (`X-Gift-Version`) |
| `GET /bilhetinhos` | `{today, items}`; os agendados vêm sem título |
| `POST /bilhetinhos` `{date, title, image}` | Publica um bilhetinho; pode haver vários no mesmo dia |
| `GET /bilhetinhos/:id/imagem` | A imagem, como *data URL*; agendados respondem 403 até o dia |
| `PUT /bilhetinhos/:id` | Atualiza um bilhetinho (`X-Gift-Version`) |
| `DELETE /bilhetinhos/:id` | Exclui um bilhetinho (`X-Gift-Version`) |
| `GET /bilhetinhos/acesso` | A chave que cifra os rascunhos no navegador |
| `PUT /bilhetinhos/acesso` | Só na migração: grava a chave antiga, se ainda não houver uma |
| `GET /poemas` | `{items}` com os poemas escritos pelo site, completos |
| `POST /poemas` `{title, date, body}` | Publica um poema (texto simples; linha em branco separa estrofes) |
| `PUT /poemas/:id` | Altera um poema (`X-Gift-Version`) |
| `DELETE /poemas/:id` | Exclui um poema (`X-Gift-Version`) |
