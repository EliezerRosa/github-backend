# GitHub Backend

Um sistema de backend que funciona como banco de dados usando arquivos JSON, com controle de versão via commits Git e simulação de transações.

## Características

✅ **Banco de dados JSON**: Armazena dados em arquivos JSON organizados por coleções  
✅ **Controle de versão**: Cada operação gera um commit Git para rastreabilidade completa  
✅ **Simulação de transações**: Sistema de transações com commit/rollback usando Git  
✅ **API RESTful**: Interface HTTP completa para operações CRUD  
✅ **Sem dependências externas**: Apenas Node.js e Git necessários  

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar o servidor
npm start

# Executar testes
node test.js
```

O servidor será iniciado na porta 3000 por padrão.

## Uso da API

### Endpoints Principais

- **GET** `/` - Documentação da API
- **GET** `/health` - Status do sistema
- **GET** `/api/data` - Estatísticas do banco de dados
- **GET** `/api/data/collections` - Listar coleções
- **GET** `/api/data/:collection` - Obter registros de uma coleção
- **POST** `/api/data/:collection` - Criar novo registro
- **PUT** `/api/data/:collection/:id` - Atualizar registro
- **DELETE** `/api/data/:collection/:id` - Deletar registro

### Transações

- **POST** `/api/transactions/begin` - Iniciar transação
- **POST** `/api/transactions/:id/commit` - Confirmar transação
- **POST** `/api/transactions/:id/rollback` - Reverter transação
- **GET** `/api/transactions` - Listar transações ativas

### Exemplos de Uso

#### Operações Básicas

```bash
# Criar um usuário
curl -X POST http://localhost:3000/api/data/users \
  -H "Content-Type: application/json" \
  -d '{"name": "João Silva", "email": "joao@example.com", "age": 30}'

# Obter todos os usuários
curl http://localhost:3000/api/data/users

# Atualizar um usuário
curl -X PUT http://localhost:3000/api/data/users/ID_DO_USUARIO \
  -H "Content-Type: application/json" \
  -d '{"age": 31, "city": "São Paulo"}'

# Deletar um usuário
curl -X DELETE http://localhost:3000/api/data/users/ID_DO_USUARIO
```

#### Transações

```bash
# Iniciar transação
curl -X POST http://localhost:3000/api/transactions/begin

# Criar registro dentro da transação
curl -X POST http://localhost:3000/api/data/users?transactionId=TX_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Maria Santos", "email": "maria@example.com"}'

# Confirmar transação
curl -X POST http://localhost:3000/api/transactions/TX_ID/commit

# OU reverter transação
curl -X POST http://localhost:3000/api/transactions/TX_ID/rollback
```

## Arquitetura

### Estrutura de Diretórios

```
├── index.js              # Servidor principal
├── services/
│   ├── DatabaseService.js # Gerenciamento de dados e Git
│   └── TransactionService.js # Sistema de transações
├── routes/
│   ├── dataRoutes.js     # Endpoints para dados
│   └── transactionRoutes.js # Endpoints para transações
├── database/
│   ├── data/             # Arquivos JSON das coleções
│   ├── metadata.json     # Metadados do banco
│   └── .git/             # Repositório Git interno
└── test.js               # Script de testes
```

### Como Funciona

1. **Armazenamento**: Cada coleção é um arquivo JSON em `database/data/`
2. **Versionamento**: Cada mudança gera um commit Git em `database/.git/`
3. **Transações**: Usam checkpoints do Git para rollback automático
4. **Metadados**: Arquivo `metadata.json` mantém estatísticas do banco

## Funcionalidades Avançadas

### Histórico e Reversão

```bash
# Ver histórico de commits
curl http://localhost:3000/api/data/history/commits

# Reverter para um commit específico
curl -X POST http://localhost:3000/api/data/history/revert \
  -H "Content-Type: application/json" \
  -d '{"commitHash": "abc123..."}'
```

### Limpeza de Transações

```bash
# Limpar transações antigas (>30 min)
curl -X POST http://localhost:3000/api/transactions/cleanup

# Abortar todas as transações ativas
curl -X POST http://localhost:3000/api/transactions/abort-all
```

### Busca e Paginação

```bash
# Buscar registros
curl "http://localhost:3000/api/data/users?search=joão&limit=10&offset=0"

# Paginação
curl "http://localhost:3000/api/data/users?limit=5&offset=10"
```

## Casos de Uso

- **Prototipagem**: Desenvolvimento rápido sem configurar banco de dados
- **Aplicações pequenas**: Projetos que não justificam DB complexo
- **Auditoria**: Rastreamento completo de mudanças via Git
- **Backup automático**: Cada mudança é versionada
- **Desenvolvimento local**: Banco leve para testes

## Limitações

- **Performance**: Não otimizado para grandes volumes de dados
- **Concorrência**: Transações são serializadas
- **Consultas**: Sem índices ou queries complexas
- **Escalabilidade**: Adequado para aplicações pequenas/médias

## Tecnologias Utilizadas

- **Node.js**: Runtime JavaScript
- **Express.js**: Framework web
- **Git**: Sistema de versionamento
- **JSON**: Formato de armazenamento
- **File System**: Operações de arquivo nativas
