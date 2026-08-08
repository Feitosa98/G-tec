# Publicação na Hostinger com Docker

Esta configuração publica a aplicação na porta `8081` do VPS e serve o site na raiz do domínio.

## Opção 1 — Docker Manager da Hostinger

1. No hPanel, abra **VPS → Gerenciar → Docker Manager**.
2. Escolha **Compose** e crie um projeto usando este repositório GitHub.
3. Confirme que o projeto usa o arquivo `docker-compose.yml`.
4. Clique em **Deploy** e aguarde o serviço ficar saudável.
5. O acesso inicial será `http://IP-DO-VPS:8081`.

## Opção 2 — Terminal do VPS

```bash
git clone https://github.com/Feitosa98/G-tec.git
cd G-tec
docker compose up -d --build
docker compose ps
```

Para acompanhar a inicialização:

```bash
docker compose logs -f web
```

## Domínio e HTTPS

1. Crie um registro DNS do tipo `A` apontando o domínio ou subdomínio para o IP do VPS.
2. No Docker Manager, configure o proxy reverso da Hostinger/Traefik para encaminhar o domínio ao serviço `web` na porta interna `80`; como alternativa, use o Nginx Proxy Manager apontando para a porta externa `8081`.
3. Ative o certificado Let's Encrypt no proxy.

## Atualização

Após enviar uma nova versão ao GitHub, atualize o projeto pelo Docker Manager. Pelo terminal:

```bash
git pull
docker compose up -d --build
```

## Comandos úteis

```bash
docker compose ps
docker compose logs --tail=100 web
docker compose restart web
docker compose down
```

> Os dados atuais ainda ficam no `localStorage` de cada navegador. O contêiner não possui banco de dados; para o SaaS real, será necessário adicionar API, banco e armazenamento persistente.
