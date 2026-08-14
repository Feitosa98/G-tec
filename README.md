# 🛒 Feitosa Soluções em Informática

![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Deploy](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue?style=for-the-badge&logo=github)

Plataforma de e-commerce moderna e completa para a **Feitosa Soluções em Informática**, desenvolvida com React e Vite. Sistema integrado de vendas online com painel administrativo, gerenciamento de produtos, pedidos e análise financeira.

## 🌐 [**Acesse a Demonstração Online →**](https://feitosa98.github.io/G-tec/)

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Como Usar](#-como-usar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Capturas de Tela](#-capturas-de-tela)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)
- [Contato](#-contato)

## 🎯 Sobre o Projeto

O sistema da **Feitosa Soluções em Informática** é uma solução completa de vendas online desenvolvida especificamente para a empresa em Manaus. O sistema oferece uma experiência de compra moderna e intuitiva para os clientes, além de um poderoso painel administrativo para gerenciamento completo do negócio.

### Principais Diferenciais

- ✨ **Interface Moderna**: Design responsivo e intuitivo
- 🔐 **Sistema de Autenticação**: Login seguro para clientes e administradores
- 📦 **Gestão de Produtos**: CRUD completo com categorização
- 🛍️ **Carrinho Inteligente**: Experiência de compra otimizada
- 📊 **Dashboard Administrativo**: Análise de vendas e métricas
- 💰 **Gestão Financeira**: Controle de receitas e despesas
- 📄 **Geração de PDFs**: Recibos e relatórios automáticos
- ⭐ **Integração Google Reviews**: Avaliações de clientes
- 📱 **Totalmente Responsivo**: Funciona em todos os dispositivos

## ✨ Funcionalidades

### Para Clientes

- 🏪 **Loja Virtual**
  - Catálogo de produtos com busca e filtros
  - Visualização detalhada de produtos
  - Especificações técnicas completas
  - Sistema de carrinho de compras
  
- 👤 **Área do Cliente**
  - Cadastro e login de usuários
  - Histórico de pedidos
  - Gerenciamento de conta
  
- 💳 **Checkout**
  - Processo de compra simplificado
  - Múltiplas formas de pagamento
  - Confirmação de pedido

### Para Administradores

- 📊 **Dashboard**
  - Visão geral de vendas
  - Gráficos e métricas em tempo real
  - Análise de desempenho
  
- 📦 **Gestão de Produtos**
  - Criar, editar e excluir produtos
  - Upload de imagens
  - Categorização e tags
  - Controle de estoque
  
- 🧾 **Gestão de Pedidos**
  - Visualização de todos os pedidos
  - Atualização de status
  - Geração de recibos em PDF
  - Exportação para Excel
  
- 💰 **Gestão Financeira**
  - Controle de receitas e despesas
  - Relatórios financeiros
  - Análise de lucros
  - Exportação de dados

## 🚀 Tecnologias

Este projeto foi desenvolvido com as seguintes tecnologias:

### Core
- **[React](https://react.dev/)** - Biblioteca JavaScript para interfaces
- **[Vite](https://vitejs.dev/)** - Build tool e dev server
- **[React Router DOM](https://reactrouter.com/)** - Roteamento

### UI/UX
- **[Lucide React](https://lucide.dev/)** - Ícones modernos
- **[React Hot Toast](https://react-hot-toast.com/)** - Notificações

### Funcionalidades
- **[jsPDF](https://github.com/parallax/jsPDF)** - Geração de PDFs
- **[jsPDF AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)** - Tabelas em PDF
- **[XLSX](https://sheetjs.com/)** - Exportação para Excel
- **[Recharts](https://recharts.org/)** - Gráficos e visualizações
- **[date-fns](https://date-fns.org/)** - Manipulação de datas

### Desenvolvimento
- **[ESLint](https://eslint.org/)** - Linting de código
- **[Vite Plugin React](https://github.com/vitejs/vite-plugin-react)** - Fast Refresh

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado em sua máquina:

- **[Node.js](https://nodejs.org/)** (versão 18 ou superior)
- **[npm](https://www.npmjs.com/)** ou **[yarn](https://yarnpkg.com/)**
- **[Git](https://git-scm.com/)**

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/Feitosa98/G-tec.git
```

### 2. Acesse a pasta do projeto

```bash
cd G-tec
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

O projeto estará rodando em `http://localhost:5173`

## 💻 Como Usar

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build de produção
npm run preview

# Executar linting
npm run lint
```

### Acesso ao Sistema

#### Área do Cliente
- Acesse `http://localhost:5173`
- Navegue pela loja e produtos
- Crie uma conta ou faça login
- Adicione produtos ao carrinho
- Finalize a compra

#### Painel Administrativo
- Acesse `http://localhost:5173/admin`
- Faça login com credenciais de administrador
- Gerencie produtos, pedidos e finanças

## NFS-e Nacional em homologação

O servidor transmite DPS 1.01 assinada com certificado A1 somente para o ambiente oficial de produção restrita. Antes de configurar no painel:

1. Defina `NFSE_SECRET_KEY` no ambiente do servidor com um segredo aleatório exclusivo de pelo menos 32 caracteres.
2. Reinicie o serviço.
3. No painel administrativo, abra **Integrações > NFS-e (Homologação)**, informe os dados fiscais e carregue o certificado `.pfx` ou `.p12`.
4. Salve, teste a conexão e só então habilite o botão de transmissão nas ordens de serviço.

Não troque a `NFSE_SECRET_KEY` enquanto houver um certificado armazenado. A troca da chave exige carregar novamente o certificado A1.

## 📁 Estrutura do Projeto

```
G-tec/
├── public/              # Arquivos públicos estáticos
│   ├── favicon.png
│   ├── logo.png
│   └── vite.svg
├── src/
│   ├── assets/          # Recursos estáticos
│   ├── components/      # Componentes reutilizáveis
│   │   ├── CartSidebar.jsx
│   │   ├── GoogleReviews.jsx
│   │   ├── Header.jsx
│   │   ├── Hero.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── ProductCard.jsx
│   ├── context/         # Context API
│   │   ├── AuthContext.jsx
│   │   └── DataContext.jsx
│   ├── data/            # Dados estáticos
│   │   └── products.js
│   ├── hooks/           # Custom hooks
│   │   └── useDebounce.js
│   ├── pages/           # Páginas da aplicação
│   │   ├── Admin/       # Páginas administrativas
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── CreateProduct.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Finance.jsx
│   │   │   ├── OrderManager.jsx
│   │   │   └── ProductManager.jsx
│   │   ├── AccountPage.jsx
│   │   ├── Checkout.jsx
│   │   ├── LoginPage.jsx
│   │   ├── ProductDetail.jsx
│   │   └── Store.jsx
│   ├── utils/           # Utilitários
│   │   └── toast.js
│   ├── App.css          # Estilos principais
│   ├── App.jsx          # Componente principal
│   ├── index.css        # Estilos globais
│   ├── mobile.css       # Estilos responsivos
│   └── main.jsx         # Ponto de entrada
├── .gitignore
├── eslint.config.js     # Configuração ESLint
├── index.html           # HTML principal
├── package.json         # Dependências e scripts
├── README.md            # Este arquivo
└── vite.config.js       # Configuração Vite
```

## 📸 Capturas de Tela

> Em breve: Adicione capturas de tela do projeto aqui

## 🤝 Contribuindo

Contribuições são sempre bem-vindas! Se você quer contribuir com o projeto:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Contato

**Feitosa Soluções em Informática**
- 📍 Manaus, Amazonas
- 📧 Email: iagofeitosa3@gmail.com
- 🌐 GitHub: [@Feitosa98](https://github.com/Feitosa98)

---

<div align="center">
  Desenvolvido com ❤️ por <a href="https://github.com/Feitosa98">Iago Feitosa</a>
</div>
