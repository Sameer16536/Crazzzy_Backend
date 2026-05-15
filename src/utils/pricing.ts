import { CategoryOffer, ComboDeal } from '@prisma/client';

export interface PricingItem {
  productId: number;
  variantId: number | null;
  quantity: number;
  price: number; // Unit price
  categorySlug: string;
}

export interface PricingResult {
  subtotal: number;
  comboDiscount: number;
  shippingAmount: number;
  totalAmount: number;
}

/**
 * Replicates the frontend logic for Buy X Get Y offers and Bundle deals.
 */
export function calculateOrderPricing(
  items: PricingItem[],
  offers: CategoryOffer[],
  deals: ComboDeal[]
): PricingResult {
  let subtotal = 0;
  let comboDiscount = 0;
  
  // 1. Calculate Base Subtotal
  items.forEach(item => {
    subtotal += item.price * item.quantity;
  });

  // 2. Apply Combo Deals (Fixed Price Bundles)
  // Note: For simplicity, we handle one bundle type per order or identify them by product set.
  // In our current system, ComboDeals are applied if a certain quantity of eligible products is met.
  const activeDeals = deals.filter(d => d.isActive);
  const remainingItems = [...items.map(i => ({ ...i }))];
  
  for (const deal of activeDeals) {
    const eligibleIds = JSON.parse(deal.eligibleProductIds) as number[];
    const isGlobal = eligibleIds.length === 0;
    
    // Count eligible items
    let eligibleCount = 0;
    remainingItems.forEach(i => {
      if (isGlobal || eligibleIds.includes(i.productId)) {
        eligibleCount += i.quantity;
      }
    });

    // Calculate how many bundles can be formed
    const bundleCount = Math.floor(eligibleCount / deal.requiredQuantity);
    if (bundleCount > 0) {
      const requiredTotal = bundleCount * deal.requiredQuantity;
      const bundlePrice = bundleCount * Number(deal.bundlePrice);
      
      // Calculate what these items would have cost normally
      let normalCost = 0;
      let removedCount = 0;
      
      // Sort by price ascending to give the discount on the cheapest items (standard practice)
      remainingItems.sort((a, b) => a.price - b.price);
      
      for (const item of remainingItems) {
        if (removedCount >= requiredTotal) break;
        const take = Math.min(item.quantity, requiredTotal - removedCount);
        normalCost += take * item.price;
        item.quantity -= take;
        removedCount += take;
      }
      
      comboDiscount += (normalCost - bundlePrice);
    }
  }

  // 3. Apply Category Offers (Buy X Get Y)
  // Only apply to items NOT already consumed by a Combo Deal
  const groupMap: Record<string, { totalQuantity: number, items: any[], offer: CategoryOffer }> = {};

  for (const item of remainingItems) {
    if (item.quantity <= 0) continue;
    
    const offer = offers.find(o => o.isActive && o.categorySlug === item.categorySlug);
    if (!offer) continue;

    // Use a key for category + variant price (or just category slug if we want to mix prices)
    // To match frontend, we group by CategorySlug
    const groupKey = offer.categorySlug;

    if (!groupMap[groupKey]) {
      groupMap[groupKey] = { totalQuantity: 0, items: [], offer };
    }
    groupMap[groupKey].totalQuantity += item.quantity;
    groupMap[groupKey].items.push(item);
  }

  for (const key in groupMap) {
    const { totalQuantity, items: groupItems, offer } = groupMap[key];
    const cycle = offer.buyQuantity + offer.getQuantity;
    const freeUnits = Math.floor(totalQuantity / cycle) * offer.getQuantity;
    
    if (freeUnits > 0) {
      let remainingFree = freeUnits;
      // Give discount on cheapest items in the group
      const sorted = [...groupItems].sort((a, b) => a.price - b.price);
      for (const item of sorted) {
        if (remainingFree <= 0) break;
        const take = Math.min(item.quantity, remainingFree);
        comboDiscount += take * item.price;
        remainingFree -= take;
      }
    }
  }

  const discountedTotal = subtotal - comboDiscount;
  const shippingAmount = (discountedTotal >= 999 || items.length === 0) ? 0 : 99;
  const totalAmount = discountedTotal + shippingAmount;

  return {
    subtotal,
    comboDiscount,
    shippingAmount,
    totalAmount
  };
}
