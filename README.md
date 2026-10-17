# Bomb Arena

Jogo 2D multiplayer online para 2–6 pessoas. O servidor é a autoridade sobre movimento, bombas, colisões, buffs, eliminações e vitória; o navegador apenas envia controles e desenha o estado no Canvas.

Durante a rodada aparecem três melhorias: botas aumentam a velocidade, raio amplia a explosão e detonador permite colocar mais bombas simultaneamente. Os personagens têm direção e animação de caminhada, e as bombas e explosões usam animações próprias.

## Rodar localmente

Requisitos: Node.js 18 ou mais recente.

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Para testar sozinho, abra duas janelas (ou uma janela anônima), crie a sala na primeira e use o link de convite na segunda.

Controles: setas ou WASD para andar e espaço para colocar bomba. Em telas pequenas aparecem controles por toque.

## Publicar do jeito mais simples (Render)

1. Envie esta pasta para um repositório GitHub.
2. No Render, crie um **Web Service** conectado ao repositório.
3. Use `npm install` como comando de build e `npm start` como comando inicial.
4. Publique. O Render fornece uma única URL HTTPS que serve tanto o frontend quanto o Socket.IO.

Não é preciso configurar a porta: o servidor usa automaticamente a variável `PORT` do provedor. O plano gratuito pode adormecer quando ninguém estiver jogando; a primeira abertura seguinte pode demorar um pouco.

## Frontend e servidor separados

O frontend também pode ser hospedado como site estático (Netlify, Vercel ou GitHub Pages), publicando a pasta `public`. Hospede o servidor Node em Render/Railway/Fly.io e abra o frontend com:

```
https://seu-frontend.example/?server=https%3A%2F%2Fseu-servidor.example
```

No servidor, defina `CLIENT_ORIGIN` com a origem permitida do frontend. Mais de uma origem pode ser separada por vírgula. Para máxima rapidez, prefira o deploy único: ele evita configuração de CORS e mantém o link de convite mais curto.

## Verificação

```bash
npm test
```

O teste automatizado valida a geração do mapa e o fluxo real via Socket.IO: criar sala, entrar e iniciar uma partida.
