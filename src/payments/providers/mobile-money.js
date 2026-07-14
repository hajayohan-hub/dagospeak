/**
 * MobileMoneyProvider — Simulation d'intégration MVola / Orange Money.
 */
export class MobileMoneyProvider {
  async createCheckout(planId) {
    // En production : appel API vers le backend qui initie le push USSD ou le lien de paiement
    console.log(`[Paiement] Initiation du paiement Mobile Money pour le plan : ${planId}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 'success',
          transactionId: `MM-${Date.now()}`,
          message: 'Paiement MVola/Orange Money simulé avec succès ! 🎉'
        });
      }, 1500); // Simulation du délai réseau
    });
  }
}