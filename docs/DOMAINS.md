# Domínios por escola

O Minha Escola suporta um endereço Cactus por tenant e domínio próprio verificado.

## Endereço padrão

Cada escola pode receber:

```
<slug>.escola.cactustecnologia.com.br
```

Configure DNS wildcard na borda:

```
*.escola.cactustecnologia.com.br -> gateway/reverse proxy
```

## Domínio próprio

Exemplo:

```
portal.colegioexemplo.com.br
```

O cliente deve criar:

```
portal.colegioexemplo.com.br CNAME custom.escola.cactustecnologia.com.br
```

A API só marca o domínio como verificado depois que o CNAME observado corresponde ao destino configurado.

## API

- `GET /api/school/domains` — lista os domínios e garante o subdomínio Cactus;
- `POST /api/school/domains` — cadastra domínio próprio;
- `PATCH /api/school/domains` com `action=verify` — verifica DNS;
- `PATCH /api/school/domains` com `action=primary` — define o principal;
- `DELETE /api/school/domains?id=...` — remove domínio próprio não principal.

Apenas ADMIN altera domínios.

## Isolamento

Login e sessões ativas verificam o host atual. Quando o host corresponde a um domínio verificado, o usuário só pode autenticar e manter sessão se pertencer à mesma escola.

O domínio global configurado em `APP_URL`, localhost e loopback permanecem neutros para operação administrativa e desenvolvimento.

## Produção

Variáveis:

```env
MINHA_ESCOLA_BASE_DOMAIN=escola.cactustecnologia.com.br
MINHA_ESCOLA_CUSTOM_CNAME=custom.escola.cactustecnologia.com.br
```

TLS wildcard e certificados de domínios próprios são responsabilidade do gateway de borda. Não emita certificado para domínio próprio antes da verificação DNS.
