# Secretaria de Inovação Empreendedorismo (SIE)

Sistema de gestão de projetos de inovação.

## 🚀 Começando

Estas instruções permitirão que você obtenha uma cópia do projeto em operação na sua máquina local para fins de desenvolvimento e teste.

### Pré-requisitos

Para executar este projeto, você precisará ter instalado em sua máquina:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [Docker](https://www.docker.com/) e Docker Compose

### Instalação e Execução

Para configurar todo o ambiente de desenvolvimento (Docker, Banco de Dados e Servidor) com apenas um comando, execute:

```bash
npm run dev:setup
```

Este comando irá automaticamente:

1.  Subir os containers do Docker (Postgres, Minio, Mailhog).
2.  Aguardar a inicialização do banco de dados.
3.  Rodar as migrações do Prisma.
4.  Popular o banco com dados de teste (Seeds).
5.  Iniciar o servidor de desenvolvimento Next.js.

O sistema estará disponível em `http://localhost:3000`.

### Outros Comandos Úteis

- `npm run docker:dev:up`: Apenas sobe os containers Docker.
- `npm run prisma:dev:migrate`: Roda as migrações no banco de desenvolvimento.
- `npm run prisma:dev:seed`: Popula o banco de desenvolvimento.
- `npm run dev`: Inicia apenas o servidor Next.js (assume que o banco já está rodando).

### Serviços do Ambiente

Quando o ambiente de desenvolvimento está rodando, você tem acesso aos seguintes serviços locais:

| Serviço       | URL                                            | Descrição                            | Credenciais (se houver) |
| :------------ | :--------------------------------------------- | :----------------------------------- | :---------------------- |
| **Aplicação** | [http://localhost:3000](http://localhost:3000) | Interface principal do sistema       | -                       |
| **MailHog**   | [http://localhost:8025](http://localhost:8025) | Visualizador de e-mails (SMTP Fake)  | -                       |
| **Minio**     | [http://localhost:9001](http://localhost:9001) | Console do Object Storage (S3 Local) | `minio` / `minio123`    |

> **Nota**: Todos os arquivos de upload são salvos no Minio localmente. Os e-mails enviados pelo sistema não são disparados de verdade, mas interceptados pelo MailHog.

### Dados de Teste

O comando `dev:setup` popula o banco de dados com usuários e projetos fictícios para facilitar o desenvolvimento.

#### Usuários Disponíveis

| Nome              | E-mail                    | Função                   |
| :---------------- | :------------------------ | :----------------------- |
| **Admin**         | `admin@ufr.edu.br`        | Administrador do Sistema |
| **Project Admin** | `projectadmin@ufr.edu.br` | Gestor de Projetos       |
| **Teste**         | `teste@ufr.edu.br`        | Usuário Padrão           |

> **Dica**: Em ambiente de desenvolvimento, o login é simplificado ("Magic Link"). Basta digitar o e-mail, clicar em entrar, e pegar o link de login no **MailHog** (`http://localhost:8025`).

#### Projetos

O script também gera automaticamente **30 projetos** para o usuário `teste@ufr.edu.br` com diferentes status (Rascunho, Pendente, Aprovado, etc.) e datas variadas, permitindo testar filtros, paginação e dashboards imediatamente.

### Estrutura do Projeto

Abaixo estão as principais pastas e suas responsabilidades:

- **`/actions`**: Server Actions do Next.js. Contém a lógica de negócio que roda no servidor (ex: salvar formulários, processar dados).
- **`/app`**: Rotas da aplicação (App Router).
  - `/admin`: Páginas administrativas (gestão de projetos, aprovações).
  - `/api`: Rotas de API (webhooks, endpoints REST).
  - `/projetos`: Área pública/logada de visualização e edição de projetos.
- **`/components`**: Componentes React reutilizáveis.
  - `/ui`: Componentes base (botões, inputs, cards) - via Shadcn UI.
  - `/admin`: Componentes específicos da área administrativa.
  - `/projects`: Componentes específicos de projetos (cards, status badge).
  - `/shell.tsx`: Layouts padrão de página (cabeçalho, conteúdo, paginação).
- **`/infra`**: Configurações de infraestrutura (Docker Compose, scripts de init).
- **`/lib`**: Utilitários e configurações globais.
  - `/services`: Lógica de integração com serviços externos (S3, Email).
  - `/utils`: Funções auxiliares.
- **`/prisma`**: Schema do banco de dados e scripts de Seed.
