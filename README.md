# OpenReturn

An open-source return portal and protocol specification for e-commerce.

OpenReturn defines an open, machine-readable standard for the full return and exchange lifecycle that any e-commerce platform, headless commerce tool, or AI agent can integrate with.

## The problem

Online retailers currently depend on proprietary return portal providers that operate as shipping label aggregators, taking a margin on every return shipment. This creates a misalignment of incentives: the portal provider profits from return volume, while the retailer's interest is fewer returns and more exchanges. Retailers also lose control over their return data — insights about return reasons, defect rates and SKU-level patterns sit inside the vendor's system.

There is no shared standard for how returns work programmatically. Every e-commerce platform has its own return flow, headless commerce setups are underserved, and AI agents acting on behalf of consumers have no standardized way to initiate or manage returns.

## What OpenReturn provides

**Open return protocol specification.** A machine-readable standard covering the full return lifecycle: return request initiation, structured reason capture, exchange selection, carrier selection, label generation, shipment tracking, and refund or exchange completion. The specification supports REST, MCP and A2A transports, and is designed to be compatible with Google's [Universal Commerce Protocol (UCP)](https://ucp.dev).

**Agentic interface layer.** A reference implementation for AI agents and automated tools to programmatically manage returns on behalf of consumers, with MCP server bindings alongside REST endpoints.

**Modular integration adapters.** Open-source connectors for carriers and e-commerce platforms, using retailer-owned API keys. No intermediary touches the retailer's data or takes a margin on their shipments.

**Reference return portal.** A self-hostable web application (built with Next.js) that implements the protocol and provides the full return and exchange flow for retailers and consumers. Serves as both a production-ready portal and a reference implementation for developers (or agents) building their own interfaces.

### Supported carriers

PostNL, DHL, UPS, DPD, FedEx, GLS, Budbee, Homerr

### Supported e-commerce platforms

Shopify, WooCommerce, Magento, BigCommerce, plus a generic adapter interface for headless commerce tools

### Supported payment providers (for shipping fees)

Mollie, Adyen, Stripe

## Design principles

- **Exchange-first.** Exchanges are a first-class flow, not an afterthought. When a consumer swaps a product instead of returning for a refund, the sale is preserved, and unnecessary logistics movements are avoided.
- **Retailer-owned credentials.** The retailer plugs in their own API keys for carriers, platforms and payment providers. OpenReturn does not intermediate.
- **Protocol-first.** The specification is the primary deliverable. The portal is a reference implementation of the protocol.
- **Agent-friendly.** Every flow is designed to be navigable by both human UIs and AI agents.
- **Vendor-neutral.** No lock-in to any specific carrier, platform or payment provider.
- **Self-hostable.** Retailers can run the reference portal on their own infrastructure, keeping full control over their return flow and data.

## Project status

OpenReturn is in the design and early development phase. The protocol specification is being drafted and development of the reference implementation will follow. We welcome early feedback on the protocol design through [GitHub Discussions](https://github.com/OpenReturn/openreturn/discussions).

## Architecture

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Consumer via   │  │   AI Agent       │  │  Custom Client   │
│ Reference Portal │  │  (MCP / A2A)     │  │    (REST)        │
│    (Next.js)     │  │                  │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    OpenReturn Protocol                      │
│               (REST + MCP + A2A transports)                 │
│                                                             │
│    ┌──────────┐    ┌──────────┐    ┌───────────────┐        │
│    │  Return  │    │ Exchange │    │   Tracking    │        │
│    │  Request │    │   Flow   │    │    Events     │        │
│    └──────────┘    └──────────┘    └───────────────┘        │
└──────┬──────────────────┬───────────────────┬───────────────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌────────────┐     ┌────────────┐     ┌─────────────────┐
│  Carrier   │     │  Platform  │     │    Payment      │
│  Adapters  │     │  Adapters  │     │    Adapters     │
│            │     │            │     │                 │
│ PostNL     │     │ Shopify    │     │ Mollie          │
│ DHL        │     │ WooCommerce│     │ Adyen           │
│ UPS        │     │ Magento    │     │ Stripe          │
│ DPD        │     │ BigCommerce│     │                 │
│ FedEx      │     │ Headless   │     │                 │
│ GLS        │     │            │     │                 │
│ Budbee     │     │            │     │                 │
│ Homerr     │     │            │     │                 │
└────────────┘     └────────────┘     └─────────────────┘
```

## Relation to UCP

Google's [Universal Commerce Protocol](https://ucp.dev) defines open primitives for product discovery, checkout, identity linking and order management. Its published roadmap lists post-purchase support for tracking and returns as future work. OpenReturn is designed to be architecturally compatible with UCP — following the same transport model (REST, MCP, A2A) and capability discovery patterns — and to fill this specific gap in the commerce lifecycle.

## About

OpenReturn is developed by [It Goes Forward](https://itgoesforward.com), a Netherlands-based company working on e-commerce logistics. The open-source protocol and reference implementation are developed separately from our commercial services.

## License

Apache-2.0

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, or open a [discussion](https://github.com/OpenReturn/openreturn/discussions) if you have questions or feedback on the protocol design.
