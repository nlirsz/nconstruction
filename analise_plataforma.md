# 🏗️ Análise Técnica e Comercial nConstruction

Esta documentação fornece uma visão detalhada das funcionalidades, diferenciais técnicos e proposta de valor da plataforma **nConstruction**, com o objetivo de subsidiar a definição de estratégias de precificação e modelos de assinatura.

---

## 1. Visão Geral da Plataforma
O **nConstruction** é um ecossistema completo de gestão para construtoras e incorporadoras (ERP Vertical). Ele resolve a desconexão entre o escritório (gerenciamento) e o canteiro de obras (execução), focando na rastreabilidade e transparência.

### Pilares de Valor:
- **Rastreabilidade**: Saber exatamente o que foi feito, quando e por quem.
- **Transparência**: Portal do cliente que reduz a ansiedade e aumenta a confiança na marca da construtora.
- **Agilidade**: Relatórios diários e atualizações de progresso em tempo real via mobile.

---

## 2. Inventário de Funcionalidades (Módulos)

### 📊 Gestão e Estratégia
*   **Dashboard Executivo**: Visão consolidada de KPIs (progresso real vs. planejado, status financeiro e clima).
*   **Gestão de Portfólio (Multi-Projetos)**: Alternância rápida entre diferentes obras e visualização do status global.
*   **Multi-Tenancy (Organizações)**: Suporte para grandes construtoras gerenciarem equipes e permissões de forma hierárquica.

### 🔨 Engenharia e Execução
*   **Matriz de Execução (O Carro Chefe)**: Sistema de grade que cruza pavimentos/unidades com fases de obra. Permite atualização em massa e visão microscópica do progresso.
*   **Cronograma Gantt Interativo**: Gestão de prazos com dependências e visualização de caminho crítico.
*   **RDO (Relatório Diário de Obra)**: Diário técnico obrigatório com registro de clima, equipe, atividades e ocorrências.
*   **Detalhamento de Unidade**: Histórico completo de cada apartamento/casa, ideal para vistorias de entrega.

### 📂 Inteligência de Dados e Documentos
*   **As-Built Viewer**: Gestão de projetos técnicos finais (essencial para manutenção pós-obra).
*   **Gestão Documental**: Centralização de plantas, contratos e licenças com controle de acesso.
*   **Suprimentos (Intro)**: Controle básico de materiais e solicitações para o canteiro.

### 🤝 Relacionamento e Vendas
*   **Portal do Cliente (Customer Dashboard)**: Visualização exclusiva para o comprador ver a evolução da sua unidade, fotos da obra e documentos. **(Este é um dos maiores diferenciais de venda do software)**.
*   **Galeria Fotográfica**: Registro visual por fase e local, com compressão automática e timestamp.

---

## 3. Diferenciais Técnicos (Qualidades)

1.  **Sincronização em Tempo Real**: Baseado em Supabase, todas as alterações no canteiro refletem instantaneamente no dashboard do escritório.
2.  **Segurança de Dados (RLS)**: Arquitetura robusta de Row Level Security, garantindo que clientes só vejam o que lhes pertence e equipes vejam apenas suas obras.
3.  **Mobile First / PWA**: Interface otimizada para uso em smartphones, permitindo que o engenheiro atualize a obra "com o pé na areia".
4.  **White-Labeling**: Possibilidade de cada construtora usar seu próprio logo e cores (Personalização de Tema).

---

## 4. Análise para Monetização (Estratégia de Cobrança)

Ao definir o valor da assinatura, considere estes três modelos comuns no mercado de SaaS de construção:

### Opção A: Por Obra/Projeto (Tiered)
Ideal para pequenas e médias construtoras.
- **Free/Basic**: 1 projeto, 2 usuários (Engenheiro e Adm).
- **Pro**: Até 3 projetos, usuários ilimitados.
- **Standard/Corporate**: Projetos ilimitados.

### Opção B: Por Unidade Gerenciada (Per-Unit)
O modelo que mais escala com o sucesso do cliente.
- Cobrar um valor fixo por apartamento/casa em execução (ex: R$ 5,00 a R$ 10,00 por unidade/mês).
- Faz sentido porque o valor gerado para uma torre de 100 apartamentos é muito maior que para uma casa.

### Opção C: Enterprise (Assinatura Consultiva)
Foco em grandes incorporadoras.
- Inclui customizações de White-Label.
- Suporte prioritário.
- Hosting dedicado.

---

## 5. Próximos Passos Recomendados
1.  **Módulo Financeiro**: Finalizar a integração de custos (Orçado vs. Realizado) para aumentar o ticket médio.
2.  **App Mobile Nativo**: Explorar a transformação do PWA em app via Capacitor para uso offline (canteiros com sinal ruim).
3.  **Automação de Relatórios**: Envio semanal automático de PDF de progresso para os clientes por e-mail/WhatsApp.

---
**Conclusão**: O app possui maturidade de mercado. A presença do **Portal do Cliente** e da **Matriz de Execução** permite que você cobre não apenas como uma ferramenta de gestão, mas como um **valor agregado de marketing** para a construtora perante seus clientes.
