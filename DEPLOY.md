# Configuração de Deploy Automático - Google Cloud Run

Este projeto está configurado para fazer deploy automático no Google Cloud Run sempre que você fizer push na branch `main`.

## 🔧 Configuração Necessária (Uma Vez Apenas)

### 1. Criar Service Account no Google Cloud

Execute estes comandos no terminal (ou no Cloud Shell):

```bash
# 1. Criar service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deploy" \
  --project=nconstruction-449220

# 2. Adicionar permissões necessárias
gcloud projects add-iam-policy-binding nconstruction-449220 \
  --member="serviceAccount:github-actions@nconstruction-449220.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding nconstruction-449220 \
  --member="serviceAccount:github-actions@nconstruction-449220.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding nconstruction-449220 \
  --member="serviceAccount:github-actions@nconstruction-449220.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 3. Criar e baixar a chave JSON
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@nconstruction-449220.iam.gserviceaccount.com
```

### 2. Adicionar Secret no GitHub

1. Acesse: https://github.com/nlirsz/nconstruction/settings/secrets/actions
2. Clique em "New repository secret"
3. Nome: `GCP_SA_KEY`
4. Valor: Cole o conteúdo completo do arquivo `github-actions-key.json`
5. Clique em "Add secret"

### 3. Habilitar APIs no Google Cloud

```bash
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project=nconstruction-449220
```

## 🚀 Como Usar

Após a configuração inicial, o deploy é automático:

1. Faça suas alterações no código
2. Commit: `git commit -m "sua mensagem"`
3. Push: `git push origin main`
4. ✅ O GitHub Actions fará o deploy automaticamente!

## 📊 Acompanhar Deploy

- Acesse: https://github.com/nlirsz/nconstruction/actions
- Veja o progresso em tempo real
- A URL do app será exibida no final do deploy

## 🌐 URL do App

Após o primeiro deploy, seu app estará disponível em:
`https://nconstruction-app-[hash].us-central1.run.app`

A URL exata será exibida no log do GitHub Actions.

## 💡 Dicas

- O deploy leva ~3-5 minutos
- Erros aparecem na aba "Actions" do GitHub
- Você pode fazer rollback para versões anteriores pelo Cloud Console
- O app escala automaticamente de 0 a 3 instâncias conforme demanda
