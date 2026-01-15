# Projeto Currículo Automatizado

Projeto Node.js para ler arquivo CSV contendo links de vagas de emprego, baixar as descrições das vagas, e **gerar automaticamente currículos ATS-friendly otimizados** para cada vaga usando IA.

## 📋 Requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- Conta OpenAI com API Key (para geração de currículos)

## 🚀 Instalação

> 💡 **Dica**: Consulte o arquivo [SETUP.md](SETUP.md) para um guia passo a passo de configuração!

1. Instale as dependências:
```bash
npm install
```

2. Configure os arquivos necessários:
   - Copie `curriculo.example` para `curriculo.txt` e preencha com suas informações
   - Copie `vagas.csv.example` para `vagas.csv` e adicione os links das vagas
   - Copie `.env.example` para `.env` e configure sua API Key

3. Configure a API Key da OpenAI:
   - Crie um arquivo `.env` na raiz do projeto
   - Adicione sua chave da API:
   ```
   OPENAI_API_KEY=sua_chave_api_aqui
   OPENAI_MODEL=gpt-4
   ```
   - Obtenha sua chave em: https://platform.openai.com/api-keys

3. (Opcional) Configure um prompt personalizado:
   - Copie `prompt_agente.txt.example` para `prompt_agente.txt`
   - Edite o arquivo com suas instruções personalizadas para o agente de IA

## 📝 Uso

1. Prepare um arquivo CSV chamado `vagas.csv` na raiz do projeto com a coluna `link`:

```csv
link
https://www.linkedin.com/jobs/view/1234567890
https://www.linkedin.com/jobs/view/0987654321
```

2. Execute o projeto:
```bash
npm start
```

ou

```bash
node index.js
```

3. O programa irá:
   - Ler seu currículo do arquivo `curriculo.txt`
   - Ler todos os links do arquivo CSV
   - Acessar cada link e baixar a descrição da vaga
   - Salvar cada descrição em um arquivo TXT na pasta `descricoes/`
   - **Gerar automaticamente um currículo ATS-friendly otimizado para cada vaga** usando IA
   - Salvar os currículos otimizados na pasta `curriculos_otimizados/`

## 📊 Formato do CSV

O arquivo CSV deve conter pelo menos a coluna `link` (pode usar maiúsculas ou minúsculas):
- `link` ou `Link` ou `url` ou `URL`: Link da vaga (obrigatório)

**Nota:** O projeto foi otimizado para links do LinkedIn, mas pode funcionar com outros sites também.

## 📁 Estrutura do Projeto

```
.
├── index.js                    # Código principal
├── package.json                # Dependências do projeto
├── .env                        # Configurações (API Key) - NÃO commitar
├── curriculo.txt               # Seu currículo original
├── vagas.csv                   # Arquivo CSV com links de vagas
├── prompt_agente.txt           # (Opcional) Prompt personalizado do agente
├── descricoes/                 # Descrições das vagas (criada automaticamente)
│   ├── vaga_1.txt
│   ├── vaga_2.txt
│   └── ...
├── curriculos_otimizados/      # Currículos ATS-friendly gerados (criada automaticamente)
│   ├── curriculo_vaga_1.txt
│   ├── curriculo_vaga_2.txt
│   └── ...
└── README.md                   # Este arquivo
```

## 🔧 Dependências

- `csv-parse`: Biblioteca para parsing de arquivos CSV
- `puppeteer`: Biblioteca para automação de navegador (web scraping)
- `openai`: Biblioteca para integração com API da OpenAI
- `dotenv`: Gerenciamento de variáveis de ambiente

## 📝 Exemplo de Saída

```
Lendo arquivo CSV de vagas...

Total de vagas encontradas: 14

=== INICIANDO DOWNLOAD DAS DESCRIÇÕES ===

Iniciando navegador...
Navegador iniciado.

[1/14] Processando vaga 1:
  Link: https://www.linkedin.com/jobs/view/...
  Acessando: https://www.linkedin.com/jobs/view/...
  ✓ Descrição salva em: descricoes/vaga_1.txt

[2/14] Processando vaga 2:
  ...

=== PROCESSAMENTO CONCLUÍDO ===
Total de vagas processadas: 14
Arquivos salvos em: descricoes

Navegador fechado.
```

## 📄 Formato dos Arquivos TXT

Cada arquivo TXT salvo contém:
- Link da vaga
- Data de extração
- Descrição completa da vaga

## 🤖 Geração de Currículos ATS-Friendly

O sistema usa IA (OpenAI GPT-4) para gerar automaticamente currículos otimizados para cada vaga:

- **Otimização de palavras-chave**: Alinha seu currículo com as palavras-chave da vaga
- **Formatação ATS-friendly**: Formato compatível com sistemas de rastreamento de candidatos
- **Personalização por vaga**: Cada currículo é otimizado especificamente para a vaga correspondente
- **Mantém veracidade**: Todas as informações do seu currículo original são preservadas

### Personalizando o Prompt do Agente

Se você tem um prompt específico que usa no ChatGPT, você pode:

1. Copie `prompt_agente.txt.example` para `prompt_agente.txt`
2. Cole seu prompt personalizado no arquivo
3. O sistema usará seu prompt em vez do padrão

**Importante**: No prompt, você pode usar `[O currículo original será inserido aqui automaticamente]` e `[A descrição da vaga será inserida aqui automaticamente]` como placeholders, ou simplesmente escrever suas instruções - o sistema substituirá automaticamente.

## ⚠️ Observações

- O processo pode demorar alguns minutos dependendo da quantidade de vagas
- O programa aguarda 2 segundos entre cada requisição para evitar bloqueios
- Para sites que requerem autenticação (como LinkedIn), pode ser necessário fazer login manualmente no navegador antes de executar o script
- A geração de currículos usa a API da OpenAI e pode ter custos associados (consulte os preços em https://openai.com/pricing)
- Certifique-se de ter créditos suficientes na sua conta OpenAI
