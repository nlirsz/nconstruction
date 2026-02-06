# Sincronização Bidirecional: Cronograma ↔ Execução

## 📋 Visão Geral

Agora o sistema possui **sincronização bidirecional completa** entre o **Cronograma (Gantt)** e a **Execução (Matriz de Progresso)**. Isso significa que:

✅ **Cronograma → Execução**: Quando você atualiza uma tarefa no Gantt, as subtarefas correspondentes na Execução são atualizadas
✅ **Execução → Cronograma**: Quando você atualiza o progresso na Execução, a tarefa correspondente no Gantt é atualizada

---

## 🔄 Como Funciona

### 1️⃣ Execução → Cronograma (ExecutionTab.tsx)

**Arquivo**: `src/components/ExecutionTab.tsx`
**Função**: `handleSaveProgressOnly` (linhas 199-237)

**Fluxo**:
1. Você marca uma subtarefa na Execução (ex: "Concretagem" em 80%)
2. O sistema calcula a porcentagem média da fase baseada em todas as subtarefas
3. Busca todas as tarefas do Gantt vinculadas àquela unidade e fase
4. Para cada tarefa encontrada:
   - Se a tarefa tem subtarefas específicas vinculadas, calcula o progresso baseado apenas nelas
   - Se não tem subtarefas específicas, usa a porcentagem geral da fase
5. Atualiza o `progress` e `status` da tarefa no Gantt
6. Atualiza o progresso global do projeto

**Exemplo**:
```
Execução:
  Unidade: Apto 101
  Fase: Estrutura
  Subtarefas:
    - Armação: 100%
    - Concretagem: 80%
    - Cura: 60%
  Média da Fase: 80%

Cronograma (Gantt):
  Tarefa: "Estrutura - Apto 101"
  Progresso: 80% ✅ (atualizado automaticamente)
  Status: IN_PROGRESS ✅
```

---

### 2️⃣ Cronograma → Execução (App.tsx)

**Arquivo**: `src/App.tsx`
**Função**: `handleUpdateTask` (linhas 285-401)

**Fluxo**:
1. Você atualiza uma tarefa no Gantt (ex: marca "Estrutura - Apto 101" como 90%)
2. O sistema busca o progresso atual da unidade na Execução
3. Se a tarefa tem subtarefas específicas vinculadas (campo `linked_subtasks`):
   - Atualiza apenas essas subtarefas com o novo progresso
   - Recalcula a porcentagem geral da fase baseada em TODAS as subtarefas
4. Se não tem subtarefas específicas:
   - Atualiza a porcentagem geral da fase
5. Preserva as outras subtarefas que não estão vinculadas

**Exemplo**:
```
Cronograma (Gantt):
  Tarefa: "Estrutura - Apto 101"
  Progresso: 90% (você alterou manualmente)
  Subtarefas Vinculadas: ["Armação", "Concretagem"]

Execução:
  Unidade: Apto 101
  Fase: Estrutura
  Subtarefas:
    - Armação: 90% ✅ (atualizado)
    - Concretagem: 90% ✅ (atualizado)
    - Cura: 60% (preservado, pois não está vinculado)
  Nova Média da Fase: 80% (média de 90%, 90%, 60%)
```

---

## 🎯 Campos Importantes

### Tabela `tasks` (Cronograma)
- `linked_unit_id`: ID da unidade vinculada (ex: "apto-101")
- `linked_phase_id`: ID da fase vinculada (ex: "ESTR")
- `linked_subtasks`: Array de nomes de subtarefas vinculadas (ex: ["Armação", "Concretagem"])
- `progress`: Porcentagem de conclusão (0-100)
- `status`: Status da tarefa (NOT_STARTED, IN_PROGRESS, COMPLETED)

### Tabela `unit_progress` (Execução)
- `unit_id`: ID da unidade
- `phase_id`: ID da fase
- `percentage`: Porcentagem média da fase
- `subtasks`: Objeto JSON com todas as subtarefas e seus progressos
  ```json
  {
    "Armação": { "progress": 100, "photos": [...] },
    "Concretagem": { "progress": 80, "photos": [...] },
    "Cura": { "progress": 60 }
  }
  ```

---

## 🚀 Melhorias Implementadas

### ✅ Antes (Problema)
- ❌ Execução → Cronograma: Funcionava, mas não considerava subtarefas específicas
- ❌ Cronograma → Execução: Sobrescrevia a porcentagem geral, mas não atualizava subtarefas

### ✅ Depois (Solução)
- ✅ Execução → Cronograma: Calcula baseado nas subtarefas vinculadas à tarefa
- ✅ Cronograma → Execução: Atualiza subtarefas específicas e recalcula a média geral
- ✅ Preserva subtarefas não vinculadas
- ✅ Atualiza `updated_at` para rastreamento
- ✅ Melhor tratamento de erros com `console.error`

---

## 📝 Casos de Uso

### Caso 1: Atualização Granular
**Cenário**: Você tem uma tarefa no Gantt vinculada a subtarefas específicas

```
Gantt: "Instalações Hidráulicas - Apto 101"
  - linked_subtasks: ["Prumadas", "Ramais"]
  - progress: 70%

Quando você marca como 100% no Gantt:
  ✅ Prumadas: 100%
  ✅ Ramais: 100%
  ⚠️ Louças: 50% (preservado, pois não está vinculado)
  📊 Nova média da fase: 83% (média de 100%, 100%, 50%)
```

### Caso 2: Atualização Geral
**Cenário**: Você tem uma tarefa no Gantt sem subtarefas específicas

```
Gantt: "Pintura - Apto 101"
  - linked_subtasks: [] (vazio)
  - progress: 100%

Quando você marca como 100% no Gantt:
  📊 Porcentagem geral da fase: 100%
  ✅ Todas as subtarefas existentes são preservadas
```

### Caso 3: Atualização na Execução
**Cenário**: Você marca subtarefas na Execução

```
Execução: Apto 101 > Estrutura
  - Armação: 100%
  - Concretagem: 80%
  - Cura: 60%
  📊 Média: 80%

Gantt: "Estrutura - Apto 101"
  - Se tem linked_subtasks: calcula baseado nelas
  - Se não tem: usa a média geral (80%)
  ✅ progress: 80%
  ✅ status: IN_PROGRESS
```

---

## 🔧 Manutenção

### Para adicionar novas subtarefas vinculadas:
1. Edite a tarefa no Gantt
2. No campo "Subtarefas Vinculadas", selecione as subtarefas desejadas
3. Salve a tarefa
4. A sincronização será automática

### Para verificar a sincronização:
1. Abra o console do navegador (F12)
2. Procure por logs de erro: `console.error("Erro ao salvar:", err)`
3. Verifique se `updated_at` está sendo atualizado nas tabelas

---

## 📊 Diagrama de Fluxo

```
┌─────────────────┐         ┌─────────────────┐
│   CRONOGRAMA    │ ◄─────► │    EXECUÇÃO     │
│     (Gantt)     │         │    (Matriz)     │
└─────────────────┘         └─────────────────┘
        │                           │
        │ 1. Atualiza tarefa        │
        │    progress: 90%          │
        │                           │
        ├──────────────────────────►│
        │                           │
        │                    2. Busca progresso atual
        │                    3. Atualiza subtarefas vinculadas
        │                    4. Recalcula média da fase
        │                           │
        │◄──────────────────────────┤
        │                           │
        │ 5. Confirma sincronização │
        │                           │
        │                    6. Marca subtarefa
        │                       Armação: 100%
        │                           │
        │◄──────────────────────────┤
        │                           │
        │ 7. Atualiza tarefa        │
        │    progress: 93%          │
        │    status: IN_PROGRESS    │
        │                           │
```

---

## ⚠️ Observações Importantes

1. **Preservação de Dados**: A sincronização preserva subtarefas não vinculadas
2. **Cálculo de Média**: A média é sempre recalculada baseada em TODAS as subtarefas da fase
3. **Status Automático**: O status é atualizado automaticamente baseado no progresso:
   - 0%: NOT_STARTED
   - 1-99%: IN_PROGRESS
   - 100%: COMPLETED
4. **Timestamp**: Todas as atualizações incluem `updated_at` para rastreamento

---

## 🎉 Resultado

Agora você tem **sincronização bidirecional completa**! 

✅ Marque no Cronograma → Atualiza na Execução
✅ Marque na Execução → Atualiza no Cronograma
✅ Preserva dados não vinculados
✅ Recalcula médias automaticamente
✅ Atualiza status automaticamente
