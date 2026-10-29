# B2B/B2C Commerce Developer Guide

> Synced: 2026-10-22

---

## B2B Commerce and D2C Commerce Developer Guide

# B2B Commerce and D2C Commerce Developer Guide

Design a B2B Commerce or D2C Commerce solution that uses the power of Lightning
Experience. Starting with the Commerce Experience Builder template, create a customized platform
where retailers, wholesalers, distributors, and consumers can make purchases. Design your
platform to meet your business requirements and connect with all your third-party
apps.

**[B2B and D2C Commerce Data Model](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_dev_data_model.htm)**

The Commerce store template is built on a pre-configured data model. The data model supports standard and customizable business objects for a multitude of business relationships and interoperability with B2B and B2C stores, Salesforce Order Management, and Service Cloud.

**[Implementation Lifecycle: Personas](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_personas.htm)**

In Salesforce Commerce, implementation is a division of labor based on persona skill sets. The Commerce implementation lifecycle relies on three personas: a developer, an org admin, and a store admin.

**[Integrations](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_integration_architecture.htm)**

B2B and D2C Commerce integration points are embedded into the cart and checkout experience. The integration services work across B2B and B2C stores.

**[Set Up Payment Processing](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_payment_b2b_setup.htm)**

To collect credit card payment information in your store, create a payment gateway and connect it to your checkout. The adapter you also create to communicate with the gateway depends on whether you implement a server- or client-side payment process.

**[Set Up Guest Checkout for Headless Commerce Stores](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_headless_guest_container.htm)**

Setting up guest checkout for headless implementations requires enabling guest store access and, to track guest carts, modifications to checkout processing. Both server- and client-side payment processing support guest checkout for headless Commerce stores.

**[Handle Currency Changes for Active Carts](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_cart_currency_change.htm)**

Commerce carts don’t automatically support currency changes. If your store supports multiple currencies, we recommend that you make the currency picker inactive when a customer places an item in the cart. However, you can create a custom process to handle currency changes when items are in the cart.

**[Commerce SFDX Environment Setup](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_set_up_dev_env.htm)**

Salesforce recommends the Salesforce Developer Experience (SFDX) environment for building Lightning web components (LWC), and for custom tax, shipping, and payment integration packages and extensions. SFDX provides easy access to Salesforce extensions and GitHub repositories containing LWC templates and reference packages. SFDX also integrates with Salesforce CLI, the Visual Studio Code editor with the Salesforce Extension Pack, and plug-ins to quickly deploy packages and components to scratch orgs and stores.

**[Build Custom Components](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_component.htm)**

In addition to the Commerce App standard components, you can add custom components to your B2B or D2C store created with an LWR template.

**[Custom Rules for Product Readiness](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_readiness_rules.htm)**

Merchandisers can run Product Readiness on their catalogs to ensure that all products in a catalog are storefront ready. By default, Product Readiness uses a rule set that contains criteria based on SKUs, images, categories, and descriptions. If the default Product Readiness rule set doesn’t fit your organization’s needs, create a custom rule set to determine what criteria a product must fit to be considered ready.

**[B2B Commerce Checkout Flow (Aura)](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_setup_checkout_flow.htm)**

If you created your B2B store with an Aura template, use Flow Builder to create dynamic checkout flows. Use simple GitHub scripts to stand up a scratch org with a fully functioning checkout, ready to test with preconfigured buyers. Customize the checkout sequence in Experience Builder. Optionally, you can customize your checkout in Flow Builder by adding, replacing, or reordering the flow.

---

## B2B and D2C Commerce Data Model

# B2B Commerce and D2C Commerce Developer Guide

Design a B2B Commerce or D2C Commerce solution that uses the power of Lightning
Experience. Starting with the Commerce Experience Builder template, create a customized platform
where retailers, wholesalers, distributors, and consumers can make purchases. Design your
platform to meet your business requirements and connect with all your third-party
apps.

**[B2B and D2C Commerce Data Model](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_dev_data_model.htm)**

The Commerce store template is built on a pre-configured data model. The data model supports standard and customizable business objects for a multitude of business relationships and interoperability with B2B and B2C stores, Salesforce Order Management, and Service Cloud.

**[Implementation Lifecycle: Personas](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_personas.htm)**

In Salesforce Commerce, implementation is a division of labor based on persona skill sets. The Commerce implementation lifecycle relies on three personas: a developer, an org admin, and a store admin.

**[Integrations](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_integration_architecture.htm)**

B2B and D2C Commerce integration points are embedded into the cart and checkout experience. The integration services work across B2B and B2C stores.

**[Set Up Payment Processing](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_payment_b2b_setup.htm)**

To collect credit card payment information in your store, create a payment gateway and connect it to your checkout. The adapter you also create to communicate with the gateway depends on whether you implement a server- or client-side payment process.

**[Set Up Guest Checkout for Headless Commerce Stores](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_headless_guest_container.htm)**

Setting up guest checkout for headless implementations requires enabling guest store access and, to track guest carts, modifications to checkout processing. Both server- and client-side payment processing support guest checkout for headless Commerce stores.

**[Handle Currency Changes for Active Carts](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_cart_currency_change.htm)**

Commerce carts don’t automatically support currency changes. If your store supports multiple currencies, we recommend that you make the currency picker inactive when a customer places an item in the cart. However, you can create a custom process to handle currency changes when items are in the cart.

**[Commerce SFDX Environment Setup](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_set_up_dev_env.htm)**

Salesforce recommends the Salesforce Developer Experience (SFDX) environment for building Lightning web components (LWC), and for custom tax, shipping, and payment integration packages and extensions. SFDX provides easy access to Salesforce extensions and GitHub repositories containing LWC templates and reference packages. SFDX also integrates with Salesforce CLI, the Visual Studio Code editor with the Salesforce Extension Pack, and plug-ins to quickly deploy packages and components to scratch orgs and stores.

**[Build Custom Components](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_component.htm)**

In addition to the Commerce App standard components, you can add custom components to your B2B or D2C store created with an LWR template.

**[Custom Rules for Product Readiness](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_readiness_rules.htm)**

Merchandisers can run Product Readiness on their catalogs to ensure that all products in a catalog are storefront ready. By default, Product Readiness uses a rule set that contains criteria based on SKUs, images, categories, and descriptions. If the default Product Readiness rule set doesn’t fit your organization’s needs, create a custom rule set to determine what criteria a product must fit to be considered ready.

**[B2B Commerce Checkout Flow (Aura)](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_setup_checkout_flow.htm)**

If you created your B2B store with an Aura template, use Flow Builder to create dynamic checkout flows. Use simple GitHub scripts to stand up a scratch org with a fully functioning checkout, ready to test with preconfigured buyers. Customize the checkout sequence in Experience Builder. Optionally, you can customize your checkout in Flow Builder by adding, replacing, or reordering the flow.

---

## Implementation Lifecycle: Personas

# B2B Commerce and D2C Commerce Developer Guide

Design a B2B Commerce or D2C Commerce solution that uses the power of Lightning
Experience. Starting with the Commerce Experience Builder template, create a customized platform
where retailers, wholesalers, distributors, and consumers can make purchases. Design your
platform to meet your business requirements and connect with all your third-party
apps.

**[B2B and D2C Commerce Data Model](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_dev_data_model.htm)**

The Commerce store template is built on a pre-configured data model. The data model supports standard and customizable business objects for a multitude of business relationships and interoperability with B2B and B2C stores, Salesforce Order Management, and Service Cloud.

**[Implementation Lifecycle: Personas](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_personas.htm)**

In Salesforce Commerce, implementation is a division of labor based on persona skill sets. The Commerce implementation lifecycle relies on three personas: a developer, an org admin, and a store admin.

**[Integrations](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_integration_architecture.htm)**

B2B and D2C Commerce integration points are embedded into the cart and checkout experience. The integration services work across B2B and B2C stores.

**[Set Up Payment Processing](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_payment_b2b_setup.htm)**

To collect credit card payment information in your store, create a payment gateway and connect it to your checkout. The adapter you also create to communicate with the gateway depends on whether you implement a server- or client-side payment process.

**[Set Up Guest Checkout for Headless Commerce Stores](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_headless_guest_container.htm)**

Setting up guest checkout for headless implementations requires enabling guest store access and, to track guest carts, modifications to checkout processing. Both server- and client-side payment processing support guest checkout for headless Commerce stores.

**[Handle Currency Changes for Active Carts](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_cart_currency_change.htm)**

Commerce carts don’t automatically support currency changes. If your store supports multiple currencies, we recommend that you make the currency picker inactive when a customer places an item in the cart. However, you can create a custom process to handle currency changes when items are in the cart.

**[Commerce SFDX Environment Setup](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_set_up_dev_env.htm)**

Salesforce recommends the Salesforce Developer Experience (SFDX) environment for building Lightning web components (LWC), and for custom tax, shipping, and payment integration packages and extensions. SFDX provides easy access to Salesforce extensions and GitHub repositories containing LWC templates and reference packages. SFDX also integrates with Salesforce CLI, the Visual Studio Code editor with the Salesforce Extension Pack, and plug-ins to quickly deploy packages and components to scratch orgs and stores.

**[Build Custom Components](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_component.htm)**

In addition to the Commerce App standard components, you can add custom components to your B2B or D2C store created with an LWR template.

**[Custom Rules for Product Readiness](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_readiness_rules.htm)**

Merchandisers can run Product Readiness on their catalogs to ensure that all products in a catalog are storefront ready. By default, Product Readiness uses a rule set that contains criteria based on SKUs, images, categories, and descriptions. If the default Product Readiness rule set doesn’t fit your organization’s needs, create a custom rule set to determine what criteria a product must fit to be considered ready.

**[B2B Commerce Checkout Flow (Aura)](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_setup_checkout_flow.htm)**

If you created your B2B store with an Aura template, use Flow Builder to create dynamic checkout flows. Use simple GitHub scripts to stand up a scratch org with a fully functioning checkout, ready to test with preconfigured buyers. Customize the checkout sequence in Experience Builder. Optionally, you can customize your checkout in Flow Builder by adding, replacing, or reordering the flow.

---

## Integrations

# B2B Commerce and D2C Commerce Developer Guide

Design a B2B Commerce or D2C Commerce solution that uses the power of Lightning
Experience. Starting with the Commerce Experience Builder template, create a customized platform
where retailers, wholesalers, distributors, and consumers can make purchases. Design your
platform to meet your business requirements and connect with all your third-party
apps.

**[B2B and D2C Commerce Data Model](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_dev_data_model.htm)**

The Commerce store template is built on a pre-configured data model. The data model supports standard and customizable business objects for a multitude of business relationships and interoperability with B2B and B2C stores, Salesforce Order Management, and Service Cloud.

**[Implementation Lifecycle: Personas](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_personas.htm)**

In Salesforce Commerce, implementation is a division of labor based on persona skill sets. The Commerce implementation lifecycle relies on three personas: a developer, an org admin, and a store admin.

**[Integrations](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_integration_architecture.htm)**

B2B and D2C Commerce integration points are embedded into the cart and checkout experience. The integration services work across B2B and B2C stores.

**[Set Up Payment Processing](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_payment_b2b_setup.htm)**

To collect credit card payment information in your store, create a payment gateway and connect it to your checkout. The adapter you also create to communicate with the gateway depends on whether you implement a server- or client-side payment process.

**[Set Up Guest Checkout for Headless Commerce Stores](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_headless_guest_container.htm)**

Setting up guest checkout for headless implementations requires enabling guest store access and, to track guest carts, modifications to checkout processing. Both server- and client-side payment processing support guest checkout for headless Commerce stores.

**[Handle Currency Changes for Active Carts](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_cart_currency_change.htm)**

Commerce carts don’t automatically support currency changes. If your store supports multiple currencies, we recommend that you make the currency picker inactive when a customer places an item in the cart. However, you can create a custom process to handle currency changes when items are in the cart.

**[Commerce SFDX Environment Setup](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_set_up_dev_env.htm)**

Salesforce recommends the Salesforce Developer Experience (SFDX) environment for building Lightning web components (LWC), and for custom tax, shipping, and payment integration packages and extensions. SFDX provides easy access to Salesforce extensions and GitHub repositories containing LWC templates and reference packages. SFDX also integrates with Salesforce CLI, the Visual Studio Code editor with the Salesforce Extension Pack, and plug-ins to quickly deploy packages and components to scratch orgs and stores.

**[Build Custom Components](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_component.htm)**

In addition to the Commerce App standard components, you can add custom components to your B2B or D2C store created with an LWR template.

**[Custom Rules for Product Readiness](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_readiness_rules.htm)**

Merchandisers can run Product Readiness on their catalogs to ensure that all products in a catalog are storefront ready. By default, Product Readiness uses a rule set that contains criteria based on SKUs, images, categories, and descriptions. If the default Product Readiness rule set doesn’t fit your organization’s needs, create a custom rule set to determine what criteria a product must fit to be considered ready.

**[B2B Commerce Checkout Flow (Aura)](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_setup_checkout_flow.htm)**

If you created your B2B store with an Aura template, use Flow Builder to create dynamic checkout flows. Use simple GitHub scripts to stand up a scratch org with a fully functioning checkout, ready to test with preconfigured buyers. Customize the checkout sequence in Experience Builder. Optionally, you can customize your checkout in Flow Builder by adding, replacing, or reordering the flow.

---

## Set Up Payment Processing

# B2B Commerce and D2C Commerce Developer Guide

Design a B2B Commerce or D2C Commerce solution that uses the power of Lightning
Experience. Starting with the Commerce Experience Builder template, create a customized platform
where retailers, wholesalers, distributors, and consumers can make purchases. Design your
platform to meet your business requirements and connect with all your third-party
apps.

**[B2B and D2C Commerce Data Model](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_dev_data_model.htm)**

The Commerce store template is built on a pre-configured data model. The data model supports standard and customizable business objects for a multitude of business relationships and interoperability with B2B and B2C stores, Salesforce Order Management, and Service Cloud.

**[Implementation Lifecycle: Personas](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_personas.htm)**

In Salesforce Commerce, implementation is a division of labor based on persona skill sets. The Commerce implementation lifecycle relies on three personas: a developer, an org admin, and a store admin.

**[Integrations](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_integration_architecture.htm)**

B2B and D2C Commerce integration points are embedded into the cart and checkout experience. The integration services work across B2B and B2C stores.

**[Set Up Payment Processing](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_payment_b2b_setup.htm)**

To collect credit card payment information in your store, create a payment gateway and connect it to your checkout. The adapter you also create to communicate with the gateway depends on whether you implement a server- or client-side payment process.

**[Set Up Guest Checkout for Headless Commerce Stores](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_headless_guest_container.htm)**

Setting up guest checkout for headless implementations requires enabling guest store access and, to track guest carts, modifications to checkout processing. Both server- and client-side payment processing support guest checkout for headless Commerce stores.

**[Handle Currency Changes for Active Carts](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_cart_currency_change.htm)**

Commerce carts don’t automatically support currency changes. If your store supports multiple currencies, we recommend that you make the currency picker inactive when a customer places an item in the cart. However, you can create a custom process to handle currency changes when items are in the cart.

**[Commerce SFDX Environment Setup](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_set_up_dev_env.htm)**

Salesforce recommends the Salesforce Developer Experience (SFDX) environment for building Lightning web components (LWC), and for custom tax, shipping, and payment integration packages and extensions. SFDX provides easy access to Salesforce extensions and GitHub repositories containing LWC templates and reference packages. SFDX also integrates with Salesforce CLI, the Visual Studio Code editor with the Salesforce Extension Pack, and plug-ins to quickly deploy packages and components to scratch orgs and stores.

**[Build Custom Components](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_component.htm)**

In addition to the Commerce App standard components, you can add custom components to your B2B or D2C store created with an LWR template.

**[Custom Rules for Product Readiness](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_readiness_rules.htm)**

Merchandisers can run Product Readiness on their catalogs to ensure that all products in a catalog are storefront ready. By default, Product Readiness uses a rule set that contains criteria based on SKUs, images, categories, and descriptions. If the default Product Readiness rule set doesn’t fit your organization’s needs, create a custom rule set to determine what criteria a product must fit to be considered ready.

**[B2B Commerce Checkout Flow (Aura)](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_setup_checkout_flow.htm)**

If you created your B2B store with an Aura template, use Flow Builder to create dynamic checkout flows. Use simple GitHub scripts to stand up a scratch org with a fully functioning checkout, ready to test with preconfigured buyers. Customize the checkout sequence in Experience Builder. Optionally, you can customize your checkout in Flow Builder by adding, replacing, or reordering the flow.

---

## Set Up Guest Checkout for Headless Commerce Stores

# B2B Commerce and D2C Commerce Developer Guide

Design a B2B Commerce or D2C Commerce solution that uses the power of Lightning
Experience. Starting with the Commerce Experience Builder template, create a customized platform
where retailers, wholesalers, distributors, and consumers can make purchases. Design your
platform to meet your business requirements and connect with all your third-party
apps.

**[B2B and D2C Commerce Data Model](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_dev_data_model.htm)**

The Commerce store template is built on a pre-configured data model. The data model supports standard and customizable business objects for a multitude of business relationships and interoperability with B2B and B2C stores, Salesforce Order Management, and Service Cloud.

**[Implementation Lifecycle: Personas](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_personas.htm)**

In Salesforce Commerce, implementation is a division of labor based on persona skill sets. The Commerce implementation lifecycle relies on three personas: a developer, an org admin, and a store admin.

**[Integrations](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_integration_architecture.htm)**

B2B and D2C Commerce integration points are embedded into the cart and checkout experience. The integration services work across B2B and B2C stores.

**[Set Up Payment Processing](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_payment_b2b_setup.htm)**

To collect credit card payment information in your store, create a payment gateway and connect it to your checkout. The adapter you also create to communicate with the gateway depends on whether you implement a server- or client-side payment process.

**[Set Up Guest Checkout for Headless Commerce Stores](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_checkout_headless_guest_container.htm)**

Setting up guest checkout for headless implementations requires enabling guest store access and, to track guest carts, modifications to checkout processing. Both server- and client-side payment processing support guest checkout for headless Commerce stores.

**[Handle Currency Changes for Active Carts](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_cart_currency_change.htm)**

Commerce carts don’t automatically support currency changes. If your store supports multiple currencies, we recommend that you make the currency picker inactive when a customer places an item in the cart. However, you can create a custom process to handle currency changes when items are in the cart.

**[Commerce SFDX Environment Setup](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_set_up_dev_env.htm)**

Salesforce recommends the Salesforce Developer Experience (SFDX) environment for building Lightning web components (LWC), and for custom tax, shipping, and payment integration packages and extensions. SFDX provides easy access to Salesforce extensions and GitHub repositories containing LWC templates and reference packages. SFDX also integrates with Salesforce CLI, the Visual Studio Code editor with the Salesforce Extension Pack, and plug-ins to quickly deploy packages and components to scratch orgs and stores.

**[Build Custom Components](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_component.htm)**

In addition to the Commerce App standard components, you can add custom components to your B2B or D2C store created with an LWR template.

**[Custom Rules for Product Readiness](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_custom_readiness_rules.htm)**

Merchandisers can run Product Readiness on their catalogs to ensure that all products in a catalog are storefront ready. By default, Product Readiness uses a rule set that contains criteria based on SKUs, images, categories, and descriptions. If the default Product Readiness rule set doesn’t fit your organization’s needs, create a custom rule set to determine what criteria a product must fit to be considered ready.

**[B2B Commerce Checkout Flow (Aura)](atlas.en-us.b2b_b2c_comm_dev.meta/b2b_b2c_comm_dev/b2b_b2c_comm_setup_checkout_flow.htm)**

If you created your B2B store with an Aura template, use Flow Builder to create dynamic checkout flows. Use simple GitHub scripts to stand up a scratch org with a fully functioning checkout, ready to test with preconfigured buyers. Customize the checkout sequence in Experience Builder. Optionally, you can customize your checkout in Flow Builder by adding, replacing, or reordering the flow.
