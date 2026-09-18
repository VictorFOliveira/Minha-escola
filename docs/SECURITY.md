# Segurança — Minha Escola

## Modelo de isolamento

O SaaS usa `schoolId` como fronteira de tenant.

Regras críticas são aplicadas no servidor:

- sessão recarrega usuário/escola do banco;
- tenant suspenso/cancelado perde sessão efetiva;
- professor só acessa turmas atribuídas;
- aluno só acessa a matrícula vinculada;
- responsável só acessa alunos vinculados;
- financeiro recebe escopo próprio;
- Superadmin usa sessão separada.

## Autenticação

- bcrypt para senha;
- JWT assinado;
- cookies HttpOnly;
- cookie seguro em produção;
- sessões de tenant e Superadmin separadas;
- rate limit persistente para login e recuperação;
- tokens de reset armazenados somente em hash;
- reset expira em 30 minutos.

## Arquivos

- bucket privado;
- upload por URL assinada;
- MIME allowlist;
- limite de tamanho;
- confirmação do objeto após upload;
- download por rota autenticada;
- checagem de tenant e destinatário;
- HTML/SVG não são aceitos no fluxo de upload.

## Documentos

- snapshot imutável;
- código público de verificação;
- conteúdo completo exige autenticação;
- PDF e HTML usam a mesma regra de autorização;
- recibos são invalidados quando pagamento é estornado.

## Webhooks

- tokens específicos por webhook;
- API key não é usada como token do webhook;
- eventos persistidos por ID;
- reentrega não duplica baixa.

## Auditoria

Eventos sensíveis são gravados em `AuditLog`.

A política de retenção pode ser configurada pela escola.

## LGPD

- exportação de dados do titular;
- registro versionado de consentimento/ciência;
- solicitações de correção, acesso e anonimização;
- anonimização bloqueada com matrícula ativa ou cobrança aberta;
- histórico acadêmico/financeiro não é apagado automaticamente;
- ações sensíveis exigem administração e ficam auditadas.

A configuração de retenção do sistema é operacional e não substitui análise jurídica da instituição.

## Headers

A aplicação envia CSP, HSTS em produção, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, COOP e Permissions-Policy.

## Checklist de revisão

Antes da regressão final:

- Prisma validate;
- migrations em banco vazio;
- testes de isolamento multi-tenant;
- TypeScript;
- Next build;
- Dependabot;
- verificação de secrets;
- restore de backup em ambiente isolado.
