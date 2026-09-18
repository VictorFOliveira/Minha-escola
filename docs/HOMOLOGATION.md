# Homologação

## Objetivo

A homologação deve reproduzir a topologia de produção sem usar dados pessoais reais.

## Recomendação

Use:

- domínio separado, por exemplo `homolog.seudominio.com`;
- banco separado;
- bucket separado;
- credenciais sandbox do Asaas;
- remetente/e-mail separado;
- Sentry com `SENTRY_ENVIRONMENT=staging`;
- `COMPOSE_PROJECT_NAME=minha-escola-staging`.

## Dados

Use dados sintéticos ou anonimizados.

Antes do go-live de uma escola:

1. importe alunos/responsáveis/professores/turmas;
2. confira totais;
3. valide responsáveis financeiros;
4. faça matrícula e rematrícula;
5. execute diário, frequência, avaliação e boletim;
6. gere contrato/cobrança/pagamento;
7. publique comunicação;
8. emita documento PDF;
9. valide portal do aluno e responsável;
10. exporte dados e guarde o resultado do ensaio.

## Gates

A homologação só é aprovada quando:

- migration deploy funciona em banco vazio;
- CI está verde;
- dependency audit está verde;
- CodeQL está verde;
- restore drill está verde;
- regressão HTTP está verde;
- teste de carga de referência está verde;
- upload real passa pelo scanner;
- e-mail/WhatsApp/Asaas configurados no ambiente desejado;
- alertas de disponibilidade são recebidos.
