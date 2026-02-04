# Deploy Automático - Cloud Build

## ✅ ID do Projeto Correto: `gen-lang-client-0749771787`

## � Configuração (Execute no Cloud Shell)

### 1. Configurar Projeto

```bash
gcloud config set project gen-lang-client-0749771787
```

### 2. Habilitar APIs

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
```

### 3. Dar Permissões ao Cloud Build

```bash
PROJECT_NUMBER=$(gcloud projects describe gen-lang-client-0749771787 --format='value(projectNumber)')

gcloud projects add-iam-policy-binding gen-lang-client-0749771787 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding gen-lang-client-0749771787 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 4. Conectar GitHub ao Cloud Build

1. Acesse: https://console.cloud.google.com/cloud-build/triggers?project=gen-lang-client-0749771787
2. Clique em **"Connect Repository"**
3. Selecione **GitHub** → Autentique
4. Escolha: **nlirsz/nconstruction**
5. Clique em **"Connect"**

### 5. Criar Trigger de Deploy

1. Clique em **"Create Trigger"**
2. Preencha:
   - **Name**: `deploy-to-cloud-run`
   - **Event**: Push to a branch
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.yaml`
3. **Create**

## 🚀 Testar Deploy

```bash
git commit --allow-empty -m "test: Trigger deploy"
git push origin main
```

Acompanhe em: https://console.cloud.google.com/cloud-build/builds?project=gen-lang-client-0749771787

## 🌐 Ver App Depois do Deploy

https://console.cloud.google.com/run?project=gen-lang-client-0749771787
