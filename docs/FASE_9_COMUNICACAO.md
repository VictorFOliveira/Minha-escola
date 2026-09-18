# Fase 9 — Comunicação, notificações e autorizações

## Estrutura

A comunicação usa uma única fonte de verdade no banco:

```
Communication
 -> CommunicationRecipient
    -> CommunicationDelivery
 -> CommunicationAttachment
 -> AuthorizationRequest
```

## Públicos

- escola inteira;
- equipe;
- todos os alunos;
- todos os responsáveis;
- responsáveis financeiros;
- alunos de uma turma;
- responsáveis de uma turma;
- turma completa;
- aluno específico;
- responsável específico.

## Segurança

- professor só comunica com turmas/alunos/responsáveis vinculados às disciplinas que leciona;
- financeiro só comunica com responsáveis financeiros ou responsáveis individuais;
- coordenação, secretaria e administração possuem públicos institucionais;
- as regras são aplicadas no backend, não apenas no menu.

## Portal

Aluno e responsável recebem uma caixa de entrada com:

- prioridade;
- autor;
- anexos por URL segura;
- registro de leitura;
- confirmação de ciência;
- prazo de validade.

O responsável também responde autorizações por aluno, com aprovação, negativa, observação e data da resposta.

## Canais

O Portal é o canal padrão e funciona sem fornecedor externo.

E-mail e WhatsApp são opcionais. Quando habilitados, o sistema cria entregas pendentes em `CommunicationDelivery`; o adaptador do provedor pode processá-las sem alterar a regra de negócio.

## Alertas de sistema

A comunicação possui `systemKey` único por escola para impedir alertas duplicados.

Os primeiros gatilhos integrados são:

- fechamento do boletim final;
- geração das mensalidades;
- estrutura pronta para vencimento e inadimplência.

## Autorizações

Ao publicar um comunicado que exige autorização, o sistema cria uma solicitação por aluno e escolhe preferencialmente o responsável financeiro ativo como respondente.

## Rotas

- `/dashboard/comunicacao`
- `GET/POST /api/communications`
- `POST /api/communications/:id/publish`
- `GET/PUT /api/communications/settings`
- `GET /api/communications/options`
- `GET /api/communications/inbox`
- `POST /api/communications/inbox/:id/read`
- `POST /api/communications/inbox/:id/acknowledge`
- `POST /api/communications/authorizations/:id/respond`
