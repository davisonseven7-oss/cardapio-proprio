# Huntix · cardápios no padrão rede social

Sistema da **Hunter Marketing** para vários clientes. Cada loja tem um cardápio com cara de Instagram (stories, feed, curtidas, campeão da semana, robô no direct) e um painel próprio. Você administra todos pelo painel admin.

| Endereço | O que é |
|---|---|
| `/login` | Entrada Huntix (admin e clientes) |
| `/admin` | Seus clientes: criar, pausar, trocar endereço, criar login, abrir o painel de qualquer um |
| `/painel` | Painel do cliente: Pedidos, Relatórios, Cardápio, Stories, Feed, Loja, Pixel Meta, Conta |
| `/<loja>` | Cardápio público (ex.: `/potengi`) |

## O que cada cliente tem no painel

- **Pedidos:** chegam na hora (aviso com som), mudança de status (novo → preparando → saiu → concluído), botão para chamar o cliente no WhatsApp, filtro por data e **exportação das vendas em CSV** (abre no Excel).
- **Relatórios:** faturamento, pedidos, ticket médio, visitas, funil (visita → sacola → pedido), vendas por dia e por horário, produtos mais vendidos, bairros, formas de pagamento, mais curtidos.
- **Cardápio:** categorias, produtos com foto (ou ícone), preço, promoção do dia por dia da semana, preço de atacado, opções (tamanho, sabor, adicionais com preço), chave para pausar produto, várias lojas/marcas no mesmo cardápio.
- **Stories e Feed:** destaques e posts editáveis. O story **Hoje** é criado sozinho com as promoções do dia.
- **Loja:** nome, logo, cores, fonte, WhatsApp, horário, bairros e taxas, pedido mínimo, retirada, pagamentos, regras das curtidas, nome do robô.
- **Pixel Meta:** ID do Pixel (eventos PageView, ViewContent, AddToCart, InitiateCheckout, Contact, Purchase) e **API de Conversões** com deduplicação.

## Rodar no computador

```
npm install
npm start
```

Crie um arquivo `.env.local` (não vai para o GitHub) com:

```
ADMIN_EMAIL=seu@email.com
ADMIN_PASSWORD=uma-senha-forte
```

Na primeira vez o sistema cria o admin e os cardápios iniciais: **Potengi Rações** (`/potengi`, ativo) e **Boa Hora** (`/boahora`, pausado).

## Publicar no Railway

1. Crie o serviço a partir deste repositório (branch desejada).
2. **Variables:** `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `DATA_DIR=/data`.
3. **Volume:** adicione um volume montado em `/data`. É onde ficam o banco (`cardapio.db`) e as fotos enviadas. Sem volume, tudo some a cada deploy.
4. **Settings → Networking → Generate Domain** (depois dá para ligar um domínio próprio).

O banco é SQLite embutido no Node (22.13 ou mais novo), sem instalar nada. Quando o volume de clientes crescer muito, dá para trocar por Postgres.

## Pastas

- `server.js`, `db.js`, `seed.js`: servidor, banco e dados iniciais.
- `public/`: cardápio (`menu.html`), login, painel, admin, estilo Huntix e ícones.
- `img/`: logos e fotos usadas pelos cardápios iniciais.
- `prototipos/` e `pausados/`: versões estáticas antigas (referência).
