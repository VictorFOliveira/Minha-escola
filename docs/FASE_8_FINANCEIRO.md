# Fase 8 — Financeiro escolar e pagamentos

## Objetivo

Transformar o módulo financeiro em uma operação real vinculada à matrícula e ao responsável financeiro.

Fluxo principal:

```
Aluno
  -> Responsável(is)
    -> Responsável financeiro
      -> Matrícula
        -> Contrato financeiro
          -> Plano
          -> Bolsa/desconto
          -> Mensalidades
            -> Pagamento
            -> Conciliação
```

## Regra de responsável

Todo aluno matriculado precisa possuir:

1. pelo menos um responsável ativo;
2. exatamente um responsável marcado como financeiro.

A matrícula é bloqueada quando esses vínculos não existem.

Ao marcar um novo responsável como financeiro, o vínculo financeiro anterior do aluno é removido automaticamente.

O último responsável de um aluno não pode ser desvinculado.

Um responsável vinculado a alunos também não pode ser excluído sem antes transferir/remover esses vínculos de maneira válida.

## Portal do Responsável

Por padrão, o responsável recebe no próprio portal:

- alunos vinculados;
- situação acadêmica;
- boletim;
- resultado final;
- mensalidades sob responsabilidade financeira;
- valor e vencimento;
- status da cobrança;
- fatura, boleto e PIX quando disponíveis.

A escola pode controlar separadamente:

- `sendReportToGuardian`;
- `sendBillingToGuardian`.

A entrega por e-mail/WhatsApp ficará no módulo de comunicação. O portal já é a fonte autenticada dos documentos e cobranças.

## Gateway opcional por escola

O gateway **não é obrigatório**.

A configuração `FinanceSettings` possui três modos:

### MANUAL

Padrão do sistema.

- nenhuma API externa é chamada;
- a escola gera contratos e mensalidades no Minha Escola;
- o financeiro registra pagamentos manualmente;
- útil para dinheiro, transferência, PIX próprio ou conciliação feita fora do SaaS.

### EXTERNAL

Para escolas que já possuem sistema próprio.

- a escola informa a URL do sistema externo;
- o Minha Escola mantém o contas a receber e o portal;
- nenhuma cobrança é criada no Asaas;
- o responsável pode ser direcionado para o sistema já utilizado pela instituição.

### ASAAS

Opcional e desativado por padrão.

Quando ativado:

- responsável financeiro é criado/reutilizado como cliente;
- cobrança pode ser emitida como PIX, boleto ou fatura com escolha de forma;
- ID externo fica salvo no Minha Escola;
- PIX Copia e Cola e QR Code podem ser recuperados;
- fatura/boleto aparecem no Portal do Responsável;
- pagamentos são conciliados por Webhook.

## Segredos

A API Key nunca fica no banco nem no frontend.

Variáveis:

```env
ASAAS_ENVIRONMENT="sandbox"
ASAAS_API_KEY=""
ASAAS_WEBHOOK_TOKEN=""
```

Sandbox é o ambiente padrão.

A produção só deve ser ativada com credenciais próprias de produção.

## Webhook

Endpoint:

```
POST /api/webhooks/asaas
```

Segurança:

- valida `asaas-access-token`;
- usa `ASAAS_WEBHOOK_TOKEN`;
- API Key e token do Webhook são credenciais diferentes;
- eventos são persistidos em `PaymentWebhookEvent`;
- `provider + eventId` é único;
- reentregas do mesmo evento não duplicam baixa financeira.

Eventos tratados inicialmente:

- PAYMENT_CONFIRMED;
- PAYMENT_RECEIVED;
- PAYMENT_OVERDUE;
- PAYMENT_REFUNDED;
- PAYMENT_DELETED;
- PAYMENT_RESTORED.

## Plano financeiro

`BillingPlan` define:

- ano letivo;
- valor padrão da parcela;
- quantidade de parcelas;
- dia de vencimento;
- descrição.

Um plano pode ser reutilizado por várias matrículas.

## Contrato financeiro

`BillingContract` é único por matrícula.

Ele preserva um snapshot financeiro:

- responsável financeiro;
- plano;
- valor da parcela;
- quantidade de parcelas;
- dia de vencimento;
- primeira data;
- situação do contrato.

## Bolsas e descontos

`BillingBenefit` suporta:

- bolsa;
- desconto;
- percentual;
- valor fixo;
- data inicial;
- data final.

O desconto é aplicado na geração das parcelas.

Por segurança, não é permitido adicionar bolsa/desconto ao contrato depois que ele já possui cobranças geradas. Isso evita alteração silenciosa de histórico financeiro.

## Mensalidades

Cada parcela vira uma `Charge`.

A cobrança armazena:

- valor base;
- desconto;
- multa;
- juros;
- valor final;
- valor já pago;
- vencimento;
- status;
- matrícula;
- aluno;
- responsável financeiro;
- contrato;
- provedor;
- dados da cobrança externa, quando houver.

Status:

- PENDING;
- PARTIAL;
- PAID;
- OVERDUE;
- CANCELLED;
- REFUNDED.

Uma cobrança só entra em atraso após a data de vencimento.

## Baixa manual

O financeiro pode registrar:

- valor;
- data;
- forma;
- observação.

Pagamentos parciais são aceitos.

A baixa recalcula automaticamente:

- saldo;
- status parcial;
- status pago;
- data de quitação.

Uma cobrança ativa no Asaas não aceita baixa manual para evitar pagamento duplicado. Nesse caso, a conciliação deve vir do Webhook.

## Segurança

### ADMIN

- acesso financeiro completo;
- escolhe o modo do gateway;
- ativa/desativa integração;
- configura sistema externo.

### FINANCE

- planos;
- contratos;
- bolsas/descontos;
- parcelas;
- emissão;
- baixa;
- conciliação;
- indicadores.

O perfil FINANCE recebe somente dados de matrícula necessários ao financeiro por `/api/finance/enrollments`, sem depender de acesso acadêmico amplo.

### GUARDIAN

- vê somente alunos vinculados;
- boletins dos alunos vinculados quando habilitado;
- cobranças ligadas ao próprio responsável;
- não acessa o dashboard financeiro.

## Endpoints

- `GET/PUT /api/finance/settings`
- `GET/POST /api/finance/plans`
- `GET/POST /api/finance/contracts`
- `POST /api/finance/contracts/:id/benefits`
- `POST /api/finance/contracts/:id/generate`
- `GET /api/finance/enrollments`
- `GET /api/finance/charges`
- `POST /api/finance/charges/:id/payments`
- `POST /api/finance/charges/:id/issue`
- `GET /api/finance/summary`
- `POST /api/webhooks/asaas`

## Interface

- `/dashboard/financeiro` — operação financeira;
- `/portal/responsavel#financeiro` — cobrança e pagamento para o responsável.

## Banco de dados

Em desenvolvimento:

```bash
npm run db:generate
npm run db:push
```

Em produção, usar migração versionada antes do deploy.
