import { facilities, pharmacies, pharmacyStock } from '../data/facilities';
import { Facility, Pharmacy, PharmacyStock } from '../types';

export function rankFacilities(requiredTags: string[]): Facility[] {
  return [...facilities].sort((a, b) => {
    const aMatches = requiredTags.filter((tag) => a.capabilityTags.includes(tag)).length;
    const bMatches = requiredTags.filter((tag) => b.capabilityTags.includes(tag)).length;
    if (aMatches !== bMatches) return bMatches - aMatches;
    return (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999);
  });
}

export function matchPharmacies(drugNames: string[]): Array<Pharmacy & { matches: PharmacyStock[]; availableCount: number }> {
  const normalized = drugNames.map((drug) => drug.toLowerCase());

  return pharmacies
    .map((pharmacy) => {
      const matches = pharmacyStock.filter(
        (stock) =>
          stock.pharmacyId === pharmacy.id &&
          normalized.some((drug) => stock.drugName.includes(drug) || stock.brandName.toLowerCase().includes(drug)),
      );
      return {
        ...pharmacy,
        matches,
        availableCount: matches.reduce((total, stock) => total + stock.quantity, 0),
      };
    })
    .sort((a, b) => b.matches.length - a.matches.length || b.availableCount - a.availableCount);
}
