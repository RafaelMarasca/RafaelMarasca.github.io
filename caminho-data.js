// Textos do joguinho "dois caminhos" (caminho.html). Pode editar à vontade.
// Em cada fase o Rafo ganha flores (cada uma mostra uma frase) e a Lulu fotos
// (quase sempre 3 de cada), pelo id: as do álbum (album-data.js) ou as de "fotosExtras", abaixo.
// A ordem das fases aqui é a mesma da lista LEVELS, em caminho.js.
window.CAMINHO = {
  titulo: 'dois caminhos',
  abertura: 'Cada um do seu lado, com as suas coisinhas pra fazer. Um abre o caminho do outro. No fim, a gente se encontra.',

  // Cores dos bonequinhos (as mesmas das ilustrações).
  rafo: { nome: 'Rafo', cabelo: '#5b3d2a', roupa: '#27304d', pele: '#fbe2bd' },
  lulu: { nome: 'Lulu', cabelo: '#a9743f', roupa: '#26242b', pele: '#fde9c8' },

  fases: [
    {
      nome: 'a primeira vez',
      abre: 'Tudo começou num olhar. E numa conversa que não queria acabar.',
      dica: 'Cada um empurra a sua caixa até a marca. A caixa de um ergue a ponte do outro.',
      flores: [
        'Na primeira vez que te vi, senti que havia algo diferente em você.',
        'A conversa fluía e as horas passavam sem a gente perceber.',
        'Estar perto de você tinha uma leveza que eu não achava em lugar nenhum.'
      ],
      fotos: ['foto-29', 'foto-25', 'foto-03'],
      fecha: 'E foi assim que a gente começou.'
    },
    {
      nome: 'um espera o outro',
      abre: 'Às vezes um precisa segurar a ponte pro outro passar.',
      dica: 'O botão redondo só segura a ponte enquanto alguém fica em cima. E tem coisa alta demais pra pular: uma caixa serve de degrau.',
      flores: [
        'A gente aprendeu a amar junto. E cresceu junto.',
        'Teve vezes em que estive ausente. Você merecia presença. Me desculpa.',
        'Quero te ouvir com mais atenção. E cuidar melhor de nós.'
      ],
      fotos: ['foto-30', 'foto-10', 'foto-19'],
      fecha: 'Perto, com espaço pros dois crescerem.'
    },
    {
      nome: 'a lua',
      abre: 'Lá em cima tudo fica mais leve. Até a saudade.',
      dica: 'Aqui se pula mais alto. E uma caixa também segura o botão redondo.',
      flores: [
        'Vejo uma flor na rua e lembro das flores que eu te dava.',
        'É curioso como te encontro em tantas coisas, sem te encontrar em lugar nenhum.',
        'São oito anos tatuados no meu coração.'
      ],
      fotos: ['foto-21', 'foto-16', 'foto-22'],
      fecha: 'Daqui dá pra ver o caminho inteiro que a gente fez.'
    },
    {
      nome: 'grudadinhos',
      abre: 'Chicletinho e grudinho: aqui a gente anda junto.',
      dica: 'Cada toque move os dois uma casa. A moita segura quem bate nela; o chiclete no chão prende por uma jogada. Peguem a flor e a foto e pisem nas marcas ao mesmo tempo.',
      flores: [
        'Você é meu chicletinho, e eu adoro ser seu grudinho.',
        'Gosto de te ter colada grudadinha, do abraço que demora.',
        'Do seu lado, até ficar parado é bom.'
      ],
      fotos: ['foto-06', 'foto-13', 'foto-18'],
      fecha: 'Só mais cinco minutinhos antes de desgrudar.'
    },
    {
      nome: 'as cores da Lulu',
      abre: 'Você enxerga cor onde eu só via cinza.',
      dica: 'O Rafo escolhe a tinta pisando nos potes. Cada casa em que a Lulu pisa fica dessa cor. Deixem o chão igual ao desenho da placa.',
      flores: [
        'Você me ensinou a reparar nas cores das coisas.',
        'Acho um design duvidoso e a primeira vontade é te mostrar.',
        'Qualquer cor fica mais bonita quando é você que escolhe.'
      ],
      fotos: ['foto-15', 'foto-24', 'foto-04'],
      fecha: 'As cores, a gente escolhe junto.'
    },
    {
      nome: 'a ordem das luzes',
      abre: 'Uma lembrança acende a outra.',
      dica: 'As luzes acendem numa ordem. Pisem nelas na mesma ordem: cada um nas luzes da sua ilha.',
      flores: [
        'Quando eu penso em você, meu coração acelera.',
        'Quando eu penso em você, dou risada sozinho.',
        'Quando eu penso em você, tudo acende.'
      ],
      fotos: ['foto-08', 'foto-09', 'foto-20'],
      fecha: 'No meio de tanta luz, a mais bonita ainda é você.'
    },
    {
      nome: 'pedacinhos',
      abre: 'Tem um pedacinho de você em cada lembrança minha.',
      dica: 'Arraste cada pedaço para o lugar dele. Quando encaixa, ele gruda. Se quiser montar outra foto, toque em "escolher foto".',
      flores: [
        'Guardo cada pedacinho dos nossos dias.',
        'Até os dias comuns viram lembrança boa com você.',
        'Juntando tudo, dá uma história bonita.',
        'E ainda tem tanto pedacinho pra gente juntar.'
      ],
      // nesta fase, estas são as fotos dos quebra-cabeças, nesta ordem: as flores, as mãos dadas na mesa,
      // o coração com as mãos e a aliança (dá para trocar no botão "escolher foto"). Uma flor por foto.
      fotos: ['foto-12', 'foto-07', 'foto-17', 'foto-31'],
      fecha: 'Cada pedacinho no seu lugar.'
    },
    {
      nome: 'espelhos de luar',
      abre: 'Há luzes que continuam viajando, mesmo de longe.',
      dica: 'Cada um anda na sua ilha. Andar contra um espelho faz ele girar. Juntos, levem o luar de uma ilha à outra, até a flor de lua. Quem fica na frente do raio faz sombra.',
      flores: [
        'A luz não conhece despedida.',
        'O que a gente acendeu continua aceso em mim.',
        'Mesmo de longe, você ainda ilumina os meus dias.'
      ],
      fotos: ['foto-26', 'foto-28', 'foto-27'],
      fecha: ''
    }
  ],

  // Fotos que não estão no álbum do site. "note" é o escrito à mão embaixo da
  // foto; "caption" é a frase que aparece junto (está em branco: escreva a sua).
  fotosExtras: [
    { id: 'foto-26', src: './assets/album/foto-26.webp', note: 'jantar com flores na mesa', caption: '', alt: 'Rafo sorri apoiado na mão, numa mesa de restaurante com taças e um vasinho de flores cor-de-rosa.' },
    { id: 'foto-27', src: './assets/album/foto-27.webp', note: 'o sorrisinho no braço', caption: '', alt: 'Um braço com uma pulseira prateada e um pequeno rostinho sorridente desenhado na pele.' },
    { id: 'foto-28', src: './assets/album/foto-28.webp', note: 'chamada de vídeo', caption: '', alt: 'Captura de uma chamada de vídeo: Lulu ri deitada de lado, e Rafo aparece na janelinha do canto.' },
    { id: 'foto-29', src: './assets/album/foto-29.webp', note: 'nós dois, de noite', caption: '', alt: 'Selfie de Lulu e Rafo à noite, ao ar livre; ele faz biquinho para a câmera.' },
    { id: 'foto-30', src: './assets/album/foto-30.webp', note: 'careta contra o céu', caption: '', alt: 'Selfie vista de baixo, com o céu ao fundo: Lulu e Rafo fazem biquinho lado a lado.' },
    { id: 'foto-31', src: './assets/album/foto-31.webp', note: 'o anel e as luzes do lago', caption: '', alt: 'Uma mão com um anel, e ao fundo um lago à noite refletindo luzes coloridas.' }
  ],

  recados: {
    comeca: 'você começa com o Rafo.',
    caixaRafo: 'O Rafo abriu um caminho pra Lulu. ✦',
    caixaLulu: 'A Lulu abriu um caminho pro Rafo. ♡',
    botao: 'a ponte fica de pé enquanto alguém segurar.',
    grudados: 'vocês estão grudadinhos: os dois andam juntos.',
    semPulo: 'aqui é um passinho de cada vez: ninguém pula.',
    presa: 'grudou no chiclete! fica uma jogada sem andar.',
    marcas: 'as marcas acenderam: agora os dois, ao mesmo tempo.',
    rodada: (n, total) => `rodada ${n} de ${total}`,
    florDoRafo: 'essas flores são com o Rafo. ✿',
    fotoDaLulu: 'as fotos são com a Lulu. ▢',
    faltaAlgo: 'ainda faltam umas coisinhas nas ilhas…',
    tragaLulu: 'agora só falta a Lulu chegar. ♡',
    tragaRafo: 'agora só falta o Rafo chegar. ♡',
    caixaPresa: 'por aí ela não vai.',
    caiu: ['opa. de novo, devagarinho. ♡', 'calma, eu te espero aqui.', 'quase! mais uma vez.']
  },

  final: {
    titulo: 'a gente se encontrou.',
    texto: 'Se ainda existe em você a vontade de tentar, eu quero tentar também.',
    recado: 'a escolha é sua, sempre. ♡'
  }
};
