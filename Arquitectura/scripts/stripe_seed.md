# Stripe seed — productos y precios

## Productos
- RP9 Starter (recurring)
- RP9 Pro (recurring)
- RP9 Enterprise (custom)
- RP9 Executions (metered)
- Pack 10k Exec (one-off)
- Pack 50k Exec (one-off)
- Pack 100k Exec (one-off)

## CLI (ejemplo)
stripe products create -d name="RP9 Starter"
stripe prices create -d unit_amount=2900 -d currency=usd -d recurring[interval]=month -d product={{STARTER_ID}}
stripe prices create -d unit_amount=27840 -d currency=usd -d recurring[interval]=year -d product={{STARTER_ID}}

stripe products create -d name="RP9 Pro"
stripe prices create -d unit_amount=9900 -d currency=usd -d recurring[interval]=month -d product={{PRO_ID}}
stripe prices create -d unit_amount=95040 -d currency=usd -d recurring[interval]=year -d product={{PRO_ID}}

stripe products create -d name="RP9 Executions" -d statement_descriptor="RP9 USAGE"
stripe prices create -d product={{USAGE_ID}} -d currency=usd -d recurring[interval]=month -d billing_scheme=per_unit -d usage_type=metered -d unit_amount_decimal=0.2

stripe products create -d name="Pack 10k Exec"
stripe prices create -d product={{PACK10_ID}} -d currency=usd -d unit_amount=1500

# Sustituye IDs y pega los price IDs en .env
