# Publicação na Hostinger com Docker

A aplicação usa dois contêineres: a API/web em Node.js e o PostgreSQL. O acesso principal é `https://sistema.feitosasolucoes.com.br`; a porta `8081` permanece disponível somente para diagnóstico. Os dados ficam no volume persistente `gtec_postgres_data`.

## Variáveis obrigatórias

Cadastre estas variáveis no ambiente do projeto Docker e use valores fortes e exclusivos:

```env
GTEC_DB_PASSWORD=troque-por-uma-senha-forte
SAAS_ADMIN_USER=gestor
SAAS_ADMIN_PASSWORD=troque-por-uma-senha-forte
SAAS_TOKEN_SECRET=troque-por-uma-chave-aleatoria-longa
DEFAULT_STORE_ADMIN_PASSWORD=troque-por-uma-senha-forte
```

Não publique o arquivo `.env` no Git. A área reservada fica em `/gestor-saas` e não aparece nos menus da loja.

## Docker Manager da Hostinger

1. Abra **VPS → Gerenciar → Docker Manager**.
2. Use **Compose a partir de URL** com `docker-compose.hostinger.yml`.
3. Preencha as variáveis de ambiente antes da implantação.
4. Aguarde os serviços `db` e `web` ficarem saudáveis.
5. Acesse `https://sistema.feitosasolucoes.com.br`.

## Isolamento SaaS

- O banco `gtec_control` guarda somente o cadastro das lojas.
- Cada nova loja recebe um banco PostgreSQL físico exclusivo.
- Cada banco possui tabelas próprias de produtos, clientes, vendas, despesas, cobranças e usuários.
- Desativar uma loja bloqueia seu acesso sem apagar seu banco.

## Domínio e HTTPS

O projeto participa da rede externa `traefik-proxy` e possui as regras do Traefik para `sistema.feitosasolucoes.com.br`. Crie um registro DNS `A` com nome `sistema` apontando para `31.97.246.38`. Se o DNS estiver no Cloudflare, deixe o registro como **Somente DNS** durante a primeira emissão do certificado; depois ele pode voltar a ser proxy.

## Atualização e diagnóstico

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 web
docker compose logs --tail=100 db
```

## Backup

O volume PostgreSQL é persistente, mas deve entrar na rotina de backup da VPS. Para exportar o banco central e todos os bancos de lojas, use `pg_dumpall` dentro do contêiner `db`.
