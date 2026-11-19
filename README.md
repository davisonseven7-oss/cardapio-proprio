# Cardápio próprio · modelo Boa Hora

Cardápio digital próprio para delivery local, pensado para vender junto com o serviço de tráfego pago.
O modelo de exemplo é a **Boa Hora**, uma loja fictícia de água de coco em Natal/RN.

- `index.html` é a versão principal (híbrida).
- `prototipos/` guarda as versões anteriores: o feed estilo rede social e o primeiro protótipo do Sushi Real.
- `img/` tem as fotos ilustrativas do Pexels (uso livre).

## O que já funciona (index.html)

- **Três modos de ver o cardápio:** Vitrine (fotos grandes), Lista (cardápio normal) e Feed (posts estilo rede social). A página lembra a escolha de cada pessoa.
- **Story de promoções do dia:** abre sozinho na primeira visita do dia. As promoções mudam conforme o dia da semana (`PROMOS` no código), e o preço de promoção vale na sacola.
- **Destaques em story:** Hoje, Promo, Garrafas, Eventos, Bastidores e Curta e ganhe.
- **Curtidas:** coração em cada produto, ranking "Mais curtidos" e cartão "Campeão da semana" (o mais curtido até domingo fica 20% mais barato na semana seguinte).
- **Curta e ganhe:** quem curte 3 produtos ganha 5% de desconto, com o cupom CURTIU5 aplicado sozinho.
- **Sacola:** taxa por bairro, pedido mínimo, Pix/cartão/dinheiro, e o pedido sai formatado como mensagem de WhatsApp.
- **Robô Coquinho (direct):** atendimento automático por regras, sem IA. Entende frases como "quero 2 garrafas de 1 litro e 1 coco", mostra a promo de hoje e o mais curtido, calcula a taxa por bairro e o orçamento de evento (300 ml por pessoa).
- **Painel "Para o gestor":** simula os eventos do Pixel Meta que cada ação geraria (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Contact, curtidas).

## O que falta para virar produto

1. **Curtidas compartilhadas de verdade.** Hoje, fora do claude.ai, cada aparelho só vê as próprias curtidas. É preciso um banco de dados (sugestão: Supabase, gratuito no começo), com uma curtida por pessoa por produto por semana. O ranking ideal mistura curtidas e pedidos.
2. **WhatsApp real.** Trocar a tela "Pedido pronto" por um link `https://wa.me/55DDDNUMERO?text=...` com a mensagem do pedido.
3. **Pixel Meta + API de Conversões reais.** Trocar a função `track()` pelos eventos do Pixel e mandar o Purchase também pela CAPI, com deduplicação.
4. **Painel do lojista.** Tela para o dono trocar preço, foto, promoção do dia e pausar item sozinho.
5. **Dados reais do cliente.** Fotos próprias, produtos, preços, bairros e taxas, horário e número de WhatsApp.
6. **Robô com IA (opcional).** O robô por regras se perde com frases fora do padrão; uma versão com IA entende tudo, mas tem custo por conversa.
7. **Um cardápio por cliente.** Separar os dados (produtos, cores, logo) do código, para cada cliente ter o seu link (ex.: `/boahora`, `/sushireal`).

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `cardapio-proprio`) e envie esta pasta.
2. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch**, escolha a branch `main` e a pasta `/ (root)`.
3. Em 1 ou 2 minutos o site fica em `https://SEU-USUARIO.github.io/cardapio-proprio/`.

No plano gratuito do GitHub, o Pages só funciona com repositório **público**: qualquer pessoa pode ver o código e as fotos.

## Observações

- Loja, preços, promoções e curtidas iniciais são fictícios.
- As fotos vêm do Pexels (licença livre). Para um cliente real, use as fotos do próprio cliente.
- O código já tenta usar o banco de dados do claude.ai quando aberto lá (`window.claude.use('db')`). Fora dele, cai no modo local sem erro.
