/**
 * PaymentGateway — Abstraction des fournisseurs de paiement.
 */
export class PaymentGateway {
  #providers = new Map();

  register(name, provider) {
    this.#providers.set(name, provider);
  }

  async checkout(planId, providerName) {
    const provider = this.#providers.get(providerName);
    if (!provider) {
      throw new Error(`Fournisseur de paiement inconnu : ${providerName}`);
    }
    return provider.createCheckout(planId);
  }
}