# Revisão das dependências — 06/10/2026

A auditoria do npm identificou nove pacotes vulneráveis na árvore instalada. As atualizações de segurança reduziram o resultado para uma vulnerabilidade alta e nenhuma crítica, moderada ou baixa.

Pacotes atualizados: compression, nodemailer, proxy-addr, sharp, dompurify, brace-expansion, ip-address e source-map-js. As versões resolvidas estão registradas no package-lock.json.

## Pendência sem versão corrigida

- Pacote: node-forge 1.4.0.
- Aviso: https://github.com/advisories/GHSA-86w9-cpqp-85rv.
- Problema: verificação RSA PKCS#1 v1.5 com estruturas DigestAlgorithm malformadas.
- Na data desta revisão, o npm e o aviso publicado não apresentam versão corrigida.
- O sistema usa node-forge para extrair a chave privada e o certificado de arquivos A1/PKCS#12 em apps/server/services/nfse.ts. Não foi encontrado uso da verificação RSA vulnerável no código da aplicação. Isso não elimina o aviso nem constitui garantia de ausência de risco.
- As assinaturas XML usam xml-crypto e a comunicação TLS usa o módulo HTTPS do Node.js.

Não tratar a auditoria como limpa: a pendência permanece até uma atualização corrigida ou substituição validada da leitura de certificados. A contagem do painel da hospedagem pode divergir da contagem por pacote do npm e depender de nova análise da versão publicada.

## Validação

Executar npm test, npm run typecheck e a compilação web após atualizações. Os testes incluem leitura de A1, senha incorreta, validade do certificado e geração/assinatura de DPS.
