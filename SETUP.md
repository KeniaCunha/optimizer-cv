# 📋 Guia de Configuração

Este guia ajuda você a configurar o projeto pela primeira vez.

## 📁 Arquivos de Exemplo

O projeto inclui arquivos de exemplo para facilitar a configuração:

### 1. `curriculo.example` → `curriculo.txt`
- Copie o arquivo de exemplo para `curriculo.txt`
- Preencha com suas informações pessoais
- Mantenha o formato simples e compatível com ATS

```bash
cp curriculo.example curriculo.txt
```

### 2. `vagas.csv.example` → `vagas.csv`
- Copie o arquivo de exemplo para `vagas.csv`
- Adicione os links das vagas que deseja processar
- Um link por linha (incluindo o cabeçalho `link`)

```bash
cp vagas.csv.example vagas.csv
```

### 3. `prompt_agente.txt.example` → `prompt_agente.txt` (Opcional)
- Copie se quiser personalizar o prompt do agente de IA
- Edite com suas instruções personalizadas
- Se não copiar, o sistema usará o prompt padrão

```bash
cp prompt_agente.txt.example prompt_agente.txt
```

### 4. `.env.example` → `.env`
- Copie o arquivo de exemplo para `.env`
- Adicione sua chave da API OpenAI
- **NUNCA** commite o arquivo `.env` no Git!

```bash
cp .env.example .env
```

Depois edite o `.env` e adicione sua chave:
```
OPENAI_API_KEY=sua_chave_real_aqui
OPENAI_MODEL=gpt-4
```

## ✅ Checklist de Configuração

- [ ] Copiar `curriculo.example` para `curriculo.txt` e preencher
- [ ] Copiar `vagas.csv.example` para `vagas.csv` e adicionar links
- [ ] Copiar `.env.example` para `.env` e adicionar API Key
- [ ] (Opcional) Copiar `prompt_agente.txt.example` para `prompt_agente.txt`
- [ ] Instalar dependências: `npm install`
- [ ] Executar: `npm start`

## 🔒 Segurança

Os seguintes arquivos estão no `.gitignore` e **NÃO** serão commitados:
- `curriculo.txt` - Seu currículo pessoal
- `vagas.csv` - Seus links de vagas
- `.env` - Sua chave de API

Mantenha esses arquivos privados e seguros!
