# OpenReturn

An open-source return protocol and reference portal for e-commerce.

OpenReturn defines a machine-readable standard for the full return and exchange lifecycle that any e-commerce platform, headless commerce tool, or AI agent can integrate with. The protocol is extensible: beyond standard return-to-warehouse and exchange flows, it defines a pluggable return method interface that third-party services can implement.

## The problem

Online retailers currently depend on proprietary return portal providers that operate as shipping label aggregators, taking a margin on every return shipment. This creates a misalignment of incentives: the portal provider profits from return volume, while the retailer's interest is fewer returns and more exchanges. Retailers also lose control over their return data — insights about return reasons, defect rates and SKU-level patterns sit inside the vendor's system.

There is no shared standard for how returns work programmatically. Every e-commerce platform has its own return flow, headless commerce setups are underserved, and AI agents acting on behalf of consumers have no standardized way to initiate or manage returns.

## What OpenReturn provides

**Open return protocol specification.** A machine-readable standard covering the full return lifecycle: return request initiation, structured reason capture, exchange selection, carrier selection, label generation, shipment tracking, notification events, and refund or exchange completion. The protocol supports multiple resolution types (refund, exchange, store credit, coupon codes) and includes an extensible return method interface, so third-party services (such as customer-to-customer forwarding or recommerce channels) can plug in as additional return methods. A `/.well-known/openreturn` discovery endpoint lets AI agents resolve a retailer's domain to a working return API; retailers on UCP can alternatively advertise return capabilities in their existing UCP profile. Labels are delivered as retrievable URLs with defined expiry, so they work across browser rendering, email attachment, and MCP tool responses. The specification provides a REST API and is designed to be compatible with Google's [Universal Commerce Protocol (UCP)](https://ucp.dev).

**MCP server implementation.** An MCP server that wraps the REST API, allowing AI agents to initiate and manage returns using the [Model Context Protocol](https://modelcontextprotocol.io). Discoverable via the retailer's discovery endpoint, so a consumer can tell any MCP-capable chatbot "I want to return something from coolstore.com" and the agent can find the right endpoint. Includes agent authentication via OAuth 2.1 token delegation for the consumer-agent-retailer chain.

**Modular integration adapters.** Open-source connectors for carriers and e-commerce platforms, using retailer-owned API keys. No intermediary touches the retailer's data or takes a margin on their shipments. The adapter interfaces are designed so additional carriers, platforms and ERP systems can be added by third-party contributors.

**Reference return portal.** A self-hostable web application (built with Next.js) that implements the protocol and provides the full return and exchange flow for retailers and consumers. Includes transactional email delivery (return confirmation with label, shipment received, refund processed) via SMTP. Built to WCAG 2.1 AA accessibility standards. Serves as both a production-ready portal and a reference implementation for developers building their own interfaces.

### Supported carriers

PostNL, DHL, UPS, DPD, Budbee

The carrier adapter interface is designed so additional carriers (FedEx, GLS, Homerr and others) can be added as community contributions.

### Supported e-commerce platforms

Shopify, WooCommerce, Magento, BigCommerce, plus a generic adapter interface for headless commerce tools and ERP systems (Exact, SAP, Microsoft Dynamics, etc.)

### Supported payment providers (for return shipping fees)

Stripe (with a generic payment adapter interface for adding Mollie, Adyen and others)

## Design principles

- **Exchange-first.** Exchanges are a first-class flow, not an afterthought. When a consumer swaps a product instead of returning for a refund, the sale is preserved, and unnecessary logistics movements are avoided.
- **Extensible return methods.** The protocol defines a pluggable interface for alternative return methods. Third-party services (such as customer-to-customer forwarding) can register as return methods without protocol-level changes.
- **Consumer empowerment.** An open return protocol means consumers' AI agents can manage returns across any retailer that implements the standard, rather than navigating different proprietary portals for every store.
- **Retailer-owned credentials.** The retailer plugs in their own API keys for carriers, platforms and payment providers. OpenReturn does not intermediate.
- **Protocol-first.** The specification is the primary deliverable. The portal is a reference implementation of the protocol.
- **Agent-friendly.** Every flow is designed to be navigable by both human UIs and AI agents via MCP.
- **Vendor-neutral.** No lock-in to any specific carrier, platform or payment provider.
- **Self-hostable.** Retailers can run the reference portal on their own infrastructure, keeping full control over their return flow and data.

## Project status

OpenReturn is in the design and early development phase. The protocol specification is being drafted and development of the reference implementation will follow. We welcome early feedback on the protocol design through [GitHub Discussions](https://github.com/OpenReturn/openreturn/discussions).

## Architecture

```
                      Endpoint Discovery
            (/.well-known/openreturn or UCP profile)
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
  ┌───────────────┐  ┌────────────────┐  ┌───────────────┐
  │   Reference   │  │   AI Agent     │  │    Custom     │
  │    Portal     │  │    (MCP)       │  │    Client     │
  │   (Next.js)   │  │                │  │    (REST)     │
  └───────┬───────┘  └────────┬───────┘  └───────┬───────┘
          │                   │                  │
          └───────────────────┼──────────────────┘
                              │
                              ▼
  ┌───────────────────────────────────────────────────┐
  │               OpenReturn Core                     │
  │                                                   │
  │   REST API + MCP Server                           │
  │   Return State Machine                            │
  │   Notification Events ──────────── Email (SMTP)   │
  └───────────────┬───────────────────┬───────────────┘
                  │                   │
      ┌───────────┼───────────┐       │
      │           │           │       │
      ▼           ▼           ▼       ▼
  ┌────────┐ ┌─────────┐ ┌──────┐ ┌──────────────────┐
  │Carrier │ │Platform/│ │Pay-  │ │ Return Methods   │
  │Adapters│ │ERP      │ │ment  │ │ (extensible)     │
  │        │ │Adapters │ │Adapt.│ │                  │
  │        │ │         │ │      │ │ · Warehouse      │
  │        │ │         │ │      │ │ · Exchange       │
  │        │ │         │ │      │ │ · Third-party    │
  └────────┘ └─────────┘ └──────┘ └──────────────────┘
```

The key architectural boundaries:

- **Clients** connect via REST or MCP. External clients discover the endpoint via `/.well-known/openreturn` or the retailer's UCP profile.
- **Core** implements the protocol specification, manages the return state machine, and emits notification events.
- **Adapters** are pluggable. Each implements a generic interface with retailer-owned API keys. See the supported [carriers](#supported-carriers), [platforms](#supported-e-commerce-platforms) and [payment providers](#supported-payment-providers-for-return-shipping-fees) below.
- **Return methods** are extensible. Third-party services register via the same interface as built-in methods (return-to-warehouse, exchange).

## Relation to UCP

Google's [Universal Commerce Protocol](https://ucp.dev) defines open primitives for product discovery, checkout, identity linking and order management. Its published roadmap lists post-purchase support for tracking and returns as future work. OpenReturn is designed to be architecturally compatible with UCP and to fill this specific gap in the commerce lifecycle. Retailers on UCP can advertise return capabilities directly in their existing `/.well-known/ucp` profile, alongside checkout and order management. The protocol provides a REST API and an MCP server implementation; adding A2A Agent Card discovery is a straightforward follow-on step given the shared governance of MCP and A2A under the Linux Foundation's Agentic AI Foundation.

## Roadmap

The protocol and adapter architecture are designed to grow beyond the initial scope. Planned future integrations include:

**Marketing and email platform adapters.** Integrations with platforms like Klaviyo, so return and exchange events can trigger automated flows — for example, a follow-up email when an exchange is completed, or segmentation based on return behaviour. Many retailers already run their retention marketing through these tools, and connecting return data to them is a common gap.

**Loyalty system integrations.** Connecting the return flow to loyalty programmes so retailers can incentivize exchanges over refunds — for example, offering bonus loyalty points when a consumer chooses an exchange instead of requesting their money back.

**Store credit and coupon code generation.** The protocol defines store credit and coupon codes as resolution types. The roadmap item is the adapter-level implementation: generating actual discount codes through e-commerce platform APIs (Shopify, WooCommerce and others already support this), potentially with a retailer-defined premium (e.g. 120% of the refund value as credit) to incentivize store credit over monetary refund.

**Customer service module integrations.** Connecting the return flow to helpdesk and customer service tools (Zendesk, Freshdesk, Gorgias, etc.) so the system can automatically create support tickets when issues arise during a return — for example, when a carrier scan is overdue, when a return is flagged for review, or when a consumer reports a problem with an exchange.

**Drop-off and parcel locker networks.** Adapters for PUDO (pick-up/drop-off) networks like InPost, DHL Packstations, PostNL pick-up points, and Homerr home collection. In practice most European consumers prefer dropping off parcels at a nearby point rather than scheduling a carrier pickup, but each network has its own API. A drop-off network adapter (separate from carrier label generation) would let the protocol offer consumers a map of nearby drop-off options during the return flow.

**Recommerce and resale channel routing.** Instead of always routing returns to the warehouse, eligible items could be directed to resale platforms (Vinted, Refurbed, Back Market) or outlet channels. This fits the extensible return method interface — a resale channel registers as a return method just like customer-to-customer forwarding does. Strongly aligned with EU circular economy policy.

**Warehouse and grading integrations.** When a return arrives at the warehouse, it needs to be inspected, graded, and routed: restock, refurbish, resell, or dispose. Integrations with warehouse management systems (ShipHero, ShipBob, Ongoing, etc.) that receive structured return data from the protocol would close the loop between the consumer-facing return flow and backend operations.

**Return-in-store for online orders (BORIS).** Omnichannel retailers want consumers to be able to return online purchases in physical stores. The protocol could support this by generating a return authorization that POS systems can scan, connecting the in-store return to the same data flow as an online return.

**Cross-border return flows.** Support for customs declarations, multi-currency refunds, and routing to the nearest return hub instead of the origin warehouse. Particularly relevant for EU single market retailers selling across borders, where return logistics are significantly more complex and costly.

**Sustainability reporting.** CO2 tracking per return shipment, aggregated environmental impact dashboards, and integration with ESG reporting tools. The EU Corporate Sustainability Reporting Directive (CSRD) is creating demand for this kind of data, and the structured return data captured by the protocol provides a natural foundation for it.

**A2A Agent Card discovery.** Adding A2A support alongside the existing MCP server, so agent-to-agent commerce workflows can discover and interact with the return protocol. MCP and A2A are both governed by the Linux Foundation's Agentic AI Foundation.

These are not part of the current funded scope but are designed to be achievable through the adapter interfaces and extensible return method architecture.

## About

OpenReturn is initiated by [It Goes Forward](https://itgoesforward.com), a Netherlands-based company working on e-commerce logistics. The project team includes researchers who co-authored ["Customer-to-customer returns logistics: Can it mitigate the negative impact of product returns?"](https://doi.org/10.1016/j.omega.2024.103049) (Omega 128, 2024), a peer-reviewed study on return logistics optimization conducted jointly with Vrije Universiteit Amsterdam and Erasmus University Rotterdam.

The protocol specification is governed through an open RFC process on GitHub. Once the specification reaches a stable version, we intend to apply for governance under [The Commons Conservancy](https://commonsconservancy.org/), ensuring that protocol governance is structurally independent from any single company. The open-source deliverables are developed separately from It Goes Forward's commercial forwarding service.

## License

Apache-2.0

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, or open a [discussion](https://github.com/OpenReturn/openreturn/discussions) if you have questions or feedback on the protocol design.
