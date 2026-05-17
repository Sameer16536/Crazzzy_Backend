import { CategoryOffer, ComboDeal, ProductOffer } from '@prisma/client';

export interface PricingItem {
  productId: number;
  variantId: number | null;
  quantity: number;
  price: number; // Unit price
  categorySlug: string;
}

export interface PricingCategory {
  id: number;
  slug: string;
  parentId: number | null;
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
  deals: ComboDeal[],
  categories: PricingCategory[] = [],
  productOffers: ProductOffer[] = []
): PricingResult {
  let subtotal = 0;
  let comboDiscount = 0;
  
  // 1. Calculate Base Subtotal
  items.forEach(item => {
    subtotal += item.price * item.quantity;
  });

  // Helper to find best matching offer (self or ancestor)
  const getOfferForCategory = (slug: string): CategoryOffer | null => {
    // 1. Direct match
    const direct = offers.find(o => o.isActive && o.categorySlug === slug);
    if (direct) return direct;
    
    // 2. Ancestor match
    let currentCat = categories.find(c => c.slug === slug);
    while (currentCat?.parentId) {
      const parentId = currentCat.parentId;
      const parent = categories.find(c => c.id === parentId);
      if (!parent) break;
      const parentOffer = offers.find(o => o.isActive && o.categorySlug === parent.slug);
      if (parentOffer) return parentOffer;
      currentCat = parent;
    }
    return null;
  };

  // 2. Apply Combo Deals (Fixed Price Bundles)
  const activeDeals = deals.filter(d => d.isActive);
  const remainingItems = [...items.map(i => ({ ...i }))];
  
  for (const deal of activeDeals) {
    const eligibleIds = JSON.parse(deal.eligibleProductIds) as number[];
    const isGlobal = eligibleIds.length === 0;
    
    let eligibleCount = 0;
    remainingItems.forEach(i => {
      if (isGlobal || eligibleIds.includes(i.productId)) {
        eligibleCount += i.quantity;
      }
    });

    const bundleCount = Math.floor(eligibleCount / deal.requiredQuantity);
    if (bundleCount > 0) {
      const requiredTotal = bundleCount * deal.requiredQuantity;
      const bundlePrice = bundleCount * Number(deal.bundlePrice);
      let normalCost = 0;
      let removedCount = 0;
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

  // 2.5 Apply Product Offers (Buy X Get Y Free / Buy A Get B Free)
  const activeProductOffers = productOffers.filter(o => o.isActive);
  
  for (const offer of activeProductOffers) {
    // Check if trigger product is in the cart with quantity > 0
    const triggerItems = remainingItems.filter(item => item.productId === offer.productId && item.quantity > 0);
    const triggerQty = triggerItems.reduce((sum, item) => sum + item.quantity, 0);
    
    if (triggerQty <= 0) continue;
    
    let freeProductIds: number[] = [];
    try {
      freeProductIds = JSON.parse(offer.freeProductIds) as number[];
    } catch (e) {
      console.error('Failed to parse freeProductIds for offer:', offer.id, e);
      continue;
    }
    
    const isSameProductOffer = freeProductIds.includes(offer.productId);
    
    if (isSameProductOffer) {
      // BOGO cycle: buyQuantity + 1 (e.g. buy 1 get 1 free means cycle = 2)
      const cycle = offer.buyQuantity + 1;
      const freeUnits = Math.floor(triggerQty / cycle);
      
      if (freeUnits > 0) {
        let remainingFree = freeUnits;
        const sortedTriggerItems = [...triggerItems].sort((a, b) => a.price - b.price);
        
        for (const item of sortedTriggerItems) {
          if (remainingFree <= 0) break;
          const match = remainingItems.find(ri => ri.productId === item.productId && ri.variantId === item.variantId);
          if (match && match.quantity > 0) {
            const take = Math.min(match.quantity, remainingFree);
            comboDiscount += take * match.price;
            match.quantity -= take;
            remainingFree -= take;
          }
        }
      }
    } else {
      // Cross-product offer: Buy X triggers, get Y free products free
      const triggerCycles = Math.floor(triggerQty / offer.buyQuantity);
      if (triggerCycles <= 0) continue;
      
      for (const freeProductId of freeProductIds) {
        const freeItems = remainingItems.filter(item => item.productId === freeProductId && item.quantity > 0);
        const freeQty = freeItems.reduce((sum, item) => sum + item.quantity, 0);
        
        if (freeQty <= 0) continue;
        
        // Eligible free units is triggerCycles (e.g. buy 1, get 1 free; so triggerCycles free units)
        const eligibleFreeUnits = triggerCycles;
        let remainingFree = Math.min(freeQty, eligibleFreeUnits);
        
        const sortedFreeItems = [...freeItems].sort((a, b) => a.price - b.price);
        for (const item of sortedFreeItems) {
          if (remainingFree <= 0) break;
          const match = remainingItems.find(ri => ri.productId === item.productId && ri.variantId === item.variantId);
          if (match && match.quantity > 0) {
            const take = Math.min(match.quantity, remainingFree);
            comboDiscount += take * match.price;
            match.quantity -= take;
            remainingFree -= take;
          }
        }
      }
    }
  }

  // 3. Apply Category Offers (Buy X Get Y)
  // Group items by the OFFER they qualify for
  const groupMap: Record<number, { totalQuantity: number, items: any[], offer: CategoryOffer }> = {};

  for (const item of remainingItems) {
    if (item.quantity <= 0) continue;
    
    const offer = getOfferForCategory(item.categorySlug);
    if (!offer) continue;

    const offerId = offer.id;
    if (!groupMap[offerId]) {
      groupMap[offerId] = { totalQuantity: 0, items: [], offer };
    }
    groupMap[offerId].totalQuantity += item.quantity;
    groupMap[offerId].items.push(item);
  }

  for (const id in groupMap) {
    const { totalQuantity, items: groupItems, offer } = groupMap[id];
    const cycle = offer.buyQuantity + offer.getQuantity;
    const freeUnits = Math.floor(totalQuantity / cycle) * offer.getQuantity;
    
    if (freeUnits > 0) {
      let remainingFree = freeUnits;
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
