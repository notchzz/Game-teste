# Publicar no Render

Publique o conteúdo desta pasta na raiz de um repositório GitHub. No Render, conecte esse repositório em New > Blueprint. O arquivo render.yaml configura o serviço Node, instalação, inicialização e verificação de saúde.

Alternativa: New > Web Service, runtime Node, build `npm ci --omit=dev`, start `npm start`, plano Free e health check `/health`.

Frontend e servidor ficam no mesmo endereço HTTPS. Depois do deploy, abra a URL fornecida pelo Render, crie uma sala e copie o convite. Teste com dois navegadores antes de distribuir.

Use uma única instância: as salas ficam na memória do servidor. Reinícios e novos deploys apagam as salas. O plano gratuito pode suspender o serviço quando inativo; a próxima abertura pode demorar.

Documentação: https://render.com/docs/deploy-node-express-app e https://render.com/docs/websocket
