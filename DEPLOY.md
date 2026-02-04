# Deploy Automático via Cloud Build (SEM Service Account)

## 🎯 Solução Simplificada

Como você tem papel de **Editor** (não Owner), vamos usar Cloud Build diretamente conectado ao GitHub.

## 📋 Passo a Passo (5 minutos)

### 1. Habilitar APIs Necessárias

Acesse o Cloud Shell (https://console.cloud.google.com) e execute:

```bash
gcloud services enable cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --project=nconstruction-449220
```

### 2. Dar Permissões ao Cloud Build

```bash
# Obter o número do projeto
PROJECT_NUMBER=$(gcloud projects describe nconstruction-449220 --format='value(projectNumber)')

# Adicionar permissão de Cloud Run Admin
gcloud projects add-iam-policy-binding nconstruction-449220 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Adicionar permissão de Service Account User
gcloud projects add-iam-policy-binding nconstruction-449220 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 3. Conectar GitHub ao Cloud Build

1. Acesse: https://console.cloud.google.com/cloud-build/triggers?project=nconstruction-449220
2. Clique em **"Connect Repository"** (Conectar repositório)
3. Selecione **GitHub**
4. Autentique com sua conta GitHub
5. Selecione o repositório: **nlirsz/nconstruction**
6. Clique em **"Connect"**

### 4. Criar Trigger de Deploy

Ainda na página de Triggers:

1. Clique em **"Create Trigger"**
2. Preencha:
   - **Name**: `deploy-to-cloud-run`
   - **Event**: Push to a branch
   - **Source**: `^main$` (branch main)
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Location**: Repository
   - **Cloud Build configuration file**: `cloudbuild.yaml`
3. Clique em **"Create"**

## ✅ Pronto!

Agora, sempre que você fizer push na branch `main`, o Cloud Build automaticamente:
1. Builda a imagem Docker
2. Faz push para o Container Registry
3. Faz deploy no Cloud Run

## 🔍 Acompanhar Deploys

- Acesse: https://console.cloud.google.com/cloud-build/builds?project=nconstruction-449220
- Veja logs em tempo real
- URL do app aparece no final do deploy

## 🌐 URL do App

Após o primeiro deploy bem-sucedido, acesse:
https://console.cloud.google.com/run?project=nconstruction-449220

A URL pública estará lá (algo como `https://nconstruction-app-xxxxx-uc.a.run.app`)

## 🚀 Testar Agora

Faça um push qualquer para testar:

```bash
git commit --allow-empty -m "test: Trigger deploy"
git push origin main
```

Acompanhe em: https://console.cloud.google.com/cloud-build/builds?project=nconstruction-449220
