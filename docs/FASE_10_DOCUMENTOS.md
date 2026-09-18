# Fase 10 — Secretaria e documentos verificáveis

## Objetivo

Emitir documentos a partir dos dados reais do Minha Escola sem depender de edição manual fora do sistema.

## Tipos iniciais

- declaração de matrícula;
- declaração de frequência;
- boletim escolar;
- histórico escolar;
- recibo de pagamento;
- resumo/contrato de matrícula;
- documento personalizado.

## Snapshot imutável

Cada emissão salva:

- dados usados na emissão em `snapshot`;
- HTML renderizado;
- usuário emissor;
- data;
- código de verificação.

Alterações futuras em aluno, turma, nota ou cobrança não reescrevem um documento já emitido.

## Verificação

Cada documento recebe um código aleatório de alta entropia.

A rota pública:

```
/verificar/:code
```

mostra somente os metadados necessários para verificar a emissão e informa se o documento foi cancelado.

## Impressão

A rota autenticada:

```
/api/documents/:id/html
```

entrega uma versão limpa para impressão ou uso do recurso “Salvar como PDF” do navegador.

## Cancelamento

Documentos não são apagados. Um documento corrigido pode ser cancelado com motivo e data, preservando o histórico e o código de verificação.

## Segurança

- ADMIN, COORDINATOR e SECRETARY emitem documentos acadêmicos;
- FINANCE emite somente recibos;
- aluno acessa documentos da própria matrícula/aluno;
- responsável acessa documentos dos alunos vinculados e os próprios;
- a página pública de verificação não entrega o snapshot completo.

## Portais

Aluno e responsável possuem área “Documentos emitidos” com:

- tipo;
- título;
- data;
- código;
- abertura do documento;
- verificação pública.

## Rotas

- `/dashboard/documentos`
- `GET/POST /api/documents`
- `GET /api/documents/options`
- `GET /api/documents/mine`
- `POST /api/documents/:id/cancel`
- `GET /api/documents/:id/html`
- `/verificar/:code`
