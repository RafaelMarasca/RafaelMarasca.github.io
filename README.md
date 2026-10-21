# Uma cartinha para Lulu

“Motivos para voltar para seu ex”, personalizado para Luana Caroline de Amorim (Lulu). A versão escura com lua é a página principal. HTML, CSS e JavaScript sem dependências ou etapa de build.

| Versão | Arquivo | Direção visual |
| --- | --- | --- |
| Principal | `index.html` | Céu escuro, lua ilustrada, estrelas, tons dourados e verdes suaves. |
| Endereço anterior | `lua.html` | Redireciona para a página principal. |
| Rascunho anterior, preservado localmente | `papel.html` | Zine antigo em papel creme. Não faz parte do ZIP de publicação. |

O site tem textos naturais e fofos, referências discretas ao trabalho de designer da Lulu, razões sobre individualidade e crescimento, uma cartinha e um joguinho da cobrinha. O feedback vem por último. As respostas não são enviadas ou armazenadas.

## Prévia local

Nesta pasta, execute:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Abra a [página principal](http://127.0.0.1:4173/). A versão anterior está preservada em `papel.html` para consulta local.

## Ilustrações

Os três espaços usam desenhos bem cartunescos: Lulu feliz com flores, Lulu fazendo biquinho e o casal abraçado ao luar. As versões WebP em `assets/ilustracoes/` são compactadas para carregar bem no celular. As fotos de referência não fazem parte do site ou do ZIP.

Para trocar as imagens, altere `site-config.js`:

```js
fotos: {
  retrato: './assets/ilustracoes/lulu-feliz.webp',
  cabelo: './assets/ilustracoes/lulu-bravinha.webp',
  nosDois: './assets/ilustracoes/nos-dois-lua.webp'
}
```

A chave `cabelo` foi mantida por compatibilidade e representa a segunda ilustração. As imagens padrão também aparecem sem JavaScript. Os PNGs originais foram preservados localmente; o ZIP usa apenas os WebPs. O conjunto completo de prompts está em `assets/ilustracoes/prompts.txt`.

## Música

O MP3 fornecido, **Durand Jones & The Indications — Flower Moon**, já está em `assets/nossa-musica.mp3`, em loop e sem botão de play. Há um controle discreto para silenciar.

Se o navegador exigir interação, o próximo toque ou tecla tenta iniciar a trilha. O volume inicial é 35%. Para usar outro arquivo, altere `musica` em `site-config.js`.

[Referência sobre autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

## Animações e celular

O site inclui lua flutuante, estrelas cadentes, entradas ao rolar, partículas no toque da lua e respostas da enquete. Um céu fixo com estrelinhas e pequenas luas permanece no fundo enquanto o conteúdo passa por cima ao rolar. A lua também revela pequenas mensagens. Não depende de passar o mouse. O layout se adapta a telas pequenas, e a preferência de movimento reduzido desliga as animações.

A cartinha começa dentro de um envelope fechado. Ao tocar, o selo sai, a aba se levanta, a folha sobe e luas, estrelas e corações se espalham antes da leitura. A carta pode ser guardada e aberta de novo. O envelope funciona com toque e teclado; sem JavaScript, ainda é possível abrir e ler o texto. Com movimento reduzido, a carta abre diretamente.

## Jogo do grudinho

A cobrinha coleta corações, pizzas e luas. Funciona com deslizes, botões de direção e setas do teclado. Aos 9 pontos, o número 10 aparece e é puxado para a Lua numa animação com órbita, estrelas e corações. A lua cheia cresce e ganha um halo luminoso; o placar fica em 9. O final diz “quase, Lulu…” em destaque e “o 10 fugiu pra Lua.” Com movimento reduzido, o resultado aparece diretamente. É uma pegadinha romântica com a frase “Se fizer menos de 10 pontos, tem que voltar pra mim”, acompanhada de um recadinho deixando a escolha com a Lulu. O jogo pausa ao sair da tela e não salva placares nem envia dados.

## Feedback final

Depois do jogo, fica apenas “Só volto se você não desviar dos beijinhos” e um botão “Não volto” que foge do mouse e do toque dentro do próprio quadrinho. Pelo teclado, o botão pode ser ativado normalmente. A preferência de movimento reduzido desliga a transição. A brincadeira não envia ou salva nada.

## GitHub Pages

Para atualizar a publicação a partir deste computador, abra o terminal na pasta `New project` (que contém as duas pastas do site) e execute:

```powershell
.\publicar.cmd
```

O comando sincroniza `motivos-para-voltar` e `publicacao-github-pages`, atualiza o ZIP, cria um commit quando necessário, envia para a `main` e aguarda a publicação. Você pode editar em qualquer uma das duas pastas. Se o mesmo arquivo tiver edições diferentes nos dois lugares, o comando para antes de sobrescrever qualquer arquivo.

Para apenas conferir, sem copiar ou enviar nada:

```powershell
.\publicar.cmd --verificar
```

O comando usa Python, Git e GitHub CLI já instalados neste computador, com a conta `RafaelMarasca` conectada. Os rascunhos e PNGs não utilizados não entram na publicação. Imagens ou músicas novas referenciadas no HTML ou na configuração, dentro de `assets/`, são incluídas.

1. Extraia o ZIP de publicação e envie **seu conteúdo** para a raiz do repositório escolhido. O `index.html` deve ficar ao lado da pasta `assets`, sem uma pasta extra envolvendo os arquivos.
2. Abra **Settings → Pages**, selecione **Deploy from a branch** e escolha a branch dos arquivos e **/ (root)**.
3. Salve e aguarde a publicação.

O `index.html` já é a versão escura escolhida. Todos os caminhos são relativos, incluindo o MP3 e as fotos, para funcionar em endereços como `usuario.github.io/nome-do-repositorio/`. O `.nojekyll` está incluído. Não é preciso instalar dependências, usar Node ou configurar secrets no GitHub.

Se adicionar fotos depois de extrair o ZIP, inclua também esses arquivos no repositório e atualize `site-config.js`.

Repositório de publicação: [RafaelMarasca/RafaelMarasca.github.io](https://github.com/RafaelMarasca/RafaelMarasca.github.io). O GitHub Pages usa a branch `main` e a raiz `/`, no endereço [rafaelmarasca.github.io](https://rafaelmarasca.github.io/).

[Documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
