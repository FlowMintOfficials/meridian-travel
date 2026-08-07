import type { PackingCategory, PackingTemplate, TripType, WeatherTag } from '../types'

/**
 * Built-in packing templates. Each item can be gated on WeatherTags so
 * that "sun hat" only shows up for hot/sunny destinations and "thermal
 * base layers" only for cold ones.
 */

type SeedItem = {
  name: string
  category: PackingCategory
  quantity?: number
  essential?: boolean
  weatherTags?: WeatherTag[]
}

const UNIVERSAL_ESSENTIALS: SeedItem[] = [
  { name: 'Passport / ID', category: 'documents', essential: true },
  { name: 'Wallet + cards', category: 'documents', essential: true },
  { name: 'Cash (local currency)', category: 'documents', essential: true },
  { name: 'Phone', category: 'electronics', essential: true },
  { name: 'Phone charger', category: 'electronics', essential: true },
  { name: 'Travel insurance card', category: 'documents' },
  { name: 'Prescription meds', category: 'health', essential: true },
  { name: 'Basic first-aid kit', category: 'health' },
  { name: 'Reusable water bottle', category: 'essentials' },
]

const UNIVERSAL_TOILETRIES: SeedItem[] = [
  { name: 'Toothbrush', category: 'toiletries', essential: true },
  { name: 'Toothpaste', category: 'toiletries', essential: true },
  { name: 'Deodorant', category: 'toiletries' },
  { name: 'Shampoo / conditioner', category: 'toiletries' },
  { name: 'Body wash', category: 'toiletries' },
  { name: 'Face wash', category: 'toiletries' },
  { name: 'Moisturizer', category: 'toiletries' },
  { name: 'Razor', category: 'toiletries' },
  { name: 'Hairbrush / comb', category: 'toiletries' },
]

const UNIVERSAL_CLOTHING_BASE: SeedItem[] = [
  { name: 'Underwear', category: 'clothing', quantity: 7, essential: true },
  { name: 'Socks', category: 'clothing', quantity: 7, essential: true },
  { name: 'Sleepwear', category: 'clothing' },
]

const HOT_CLOTHING: SeedItem[] = [
  { name: 'T-shirts', category: 'clothing', quantity: 5, weatherTags: ['hot', 'warm'] },
  { name: 'Shorts', category: 'clothing', quantity: 3, weatherTags: ['hot', 'warm'] },
  { name: 'Light dresses / linen shirts', category: 'clothing', quantity: 2, weatherTags: ['hot'] },
  { name: 'Sun hat', category: 'clothing', weatherTags: ['sun', 'hot'] },
  { name: 'Sunglasses', category: 'clothing', weatherTags: ['sun', 'hot', 'warm'] },
]

const MILD_CLOTHING: SeedItem[] = [
  { name: 'Tops / shirts', category: 'clothing', quantity: 5, weatherTags: ['mild', 'cool'] },
  { name: 'Jeans / trousers', category: 'clothing', quantity: 2, weatherTags: ['mild', 'cool'] },
  { name: 'Light sweater', category: 'clothing', weatherTags: ['mild', 'cool'] },
]

const COLD_CLOTHING: SeedItem[] = [
  { name: 'Thermal base layers', category: 'clothing', quantity: 2, weatherTags: ['cold'] },
  { name: 'Warm sweater / fleece', category: 'clothing', quantity: 2, weatherTags: ['cold'] },
  { name: 'Insulated jacket', category: 'clothing', essential: true, weatherTags: ['cold', 'snow'] },
  { name: 'Beanie / warm hat', category: 'clothing', weatherTags: ['cold', 'snow'] },
  { name: 'Gloves', category: 'clothing', weatherTags: ['cold', 'snow'] },
  { name: 'Scarf', category: 'clothing', weatherTags: ['cold'] },
]

const RAIN_GEAR: SeedItem[] = [
  { name: 'Waterproof jacket', category: 'clothing', weatherTags: ['rain'] },
  { name: 'Compact umbrella', category: 'gear', weatherTags: ['rain'] },
  { name: 'Waterproof shoes', category: 'clothing', weatherTags: ['rain'] },
]

const SUN_PROTECTION: SeedItem[] = [
  { name: 'Sunscreen (SPF 30+)', category: 'toiletries', weatherTags: ['sun', 'hot'] },
  { name: 'After-sun lotion', category: 'toiletries', weatherTags: ['sun'] },
]

const ELECTRONICS_COMMON: SeedItem[] = [
  { name: 'Earbuds / headphones', category: 'electronics' },
  { name: 'Power bank', category: 'electronics' },
  { name: 'Travel plug adapter', category: 'electronics', essential: true },
]

export const BUILT_IN_TEMPLATES: PackingTemplate[] = [
  {
    id: 'tpl-general',
    name: 'General trip',
    tripType: 'general',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      ...MILD_CLOTHING,
      ...HOT_CLOTHING,
      ...COLD_CLOTHING,
      ...RAIN_GEAR,
      ...SUN_PROTECTION,
      ...ELECTRONICS_COMMON,
    ].map(withDefaults),
  },
  {
    id: 'tpl-beach',
    name: 'Beach getaway',
    tripType: 'beach',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      ...HOT_CLOTHING,
      ...SUN_PROTECTION,
      { name: 'Swimsuit', category: 'clothing', quantity: 2, essential: true },
      { name: 'Beach towel', category: 'essentials' },
      { name: 'Flip-flops / sandals', category: 'clothing', essential: true },
      { name: 'Beach bag', category: 'essentials' },
      { name: 'Snorkel gear', category: 'gear' },
      { name: 'Aloe vera / after-sun', category: 'toiletries' },
      ...ELECTRONICS_COMMON,
    ].map(withDefaults),
  },
  {
    id: 'tpl-business',
    name: 'Business trip',
    tripType: 'business',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      { name: 'Business shirts', category: 'clothing', quantity: 5, essential: true },
      { name: 'Business trousers / skirts', category: 'clothing', quantity: 2, essential: true },
      { name: 'Blazer / suit jacket', category: 'clothing' },
      { name: 'Tie / accessories', category: 'clothing' },
      { name: 'Dress shoes', category: 'clothing', essential: true },
      { name: 'Belt', category: 'clothing' },
      { name: 'Laptop', category: 'electronics', essential: true },
      { name: 'Laptop charger', category: 'electronics', essential: true },
      { name: 'Business cards', category: 'documents' },
      { name: 'Notebook + pen', category: 'other' },
      ...ELECTRONICS_COMMON,
    ].map(withDefaults),
  },
  {
    id: 'tpl-city',
    name: 'City break',
    tripType: 'city',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      ...MILD_CLOTHING,
      ...HOT_CLOTHING,
      ...COLD_CLOTHING,
      ...RAIN_GEAR,
      { name: 'Comfortable walking shoes', category: 'clothing', essential: true },
      { name: 'Daypack / small bag', category: 'gear' },
      { name: 'Reusable shopping bag', category: 'gear' },
      { name: 'Camera', category: 'electronics' },
      ...ELECTRONICS_COMMON,
    ].map(withDefaults),
  },
  {
    id: 'tpl-camping',
    name: 'Camping & hiking',
    tripType: 'camping',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      { name: 'Tent', category: 'gear', essential: true },
      { name: 'Sleeping bag', category: 'gear', essential: true },
      { name: 'Sleeping pad', category: 'gear' },
      { name: 'Camping stove + fuel', category: 'gear' },
      { name: 'Cookware + utensils', category: 'gear' },
      { name: 'Water filter / purification', category: 'gear' },
      { name: 'Headlamp + spare batteries', category: 'gear', essential: true },
      { name: 'Multi-tool / knife', category: 'gear' },
      { name: 'Fire starter', category: 'gear' },
      { name: 'Hiking boots', category: 'clothing', essential: true },
      { name: 'Moisture-wicking shirts', category: 'clothing', quantity: 3 },
      { name: 'Hiking pants', category: 'clothing', quantity: 2 },
      { name: 'Rain shell', category: 'clothing', weatherTags: ['rain'] },
      { name: 'Warm layer', category: 'clothing' },
      { name: 'Wool socks', category: 'clothing', quantity: 4 },
      { name: 'Sunscreen', category: 'toiletries', weatherTags: ['sun'] },
      { name: 'Bug spray', category: 'toiletries' },
      { name: 'Toilet paper', category: 'toiletries' },
      { name: 'Trash bags', category: 'gear' },
      { name: 'Map / offline maps', category: 'documents' },
      { name: 'Compass / GPS', category: 'gear' },
      { name: 'Whistle', category: 'gear' },
      { name: 'Snacks / trail food', category: 'other' },
    ].map(withDefaults),
  },
  {
    id: 'tpl-ski',
    name: 'Ski / snow trip',
    tripType: 'ski',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      { name: 'Ski jacket', category: 'clothing', essential: true },
      { name: 'Ski / snow pants', category: 'clothing', essential: true },
      { name: 'Thermal base layers', category: 'clothing', quantity: 3, essential: true },
      { name: 'Mid-layer fleece', category: 'clothing', quantity: 2 },
      { name: 'Wool ski socks', category: 'clothing', quantity: 4 },
      { name: 'Ski gloves / mittens', category: 'clothing', essential: true },
      { name: 'Ski helmet', category: 'gear' },
      { name: 'Goggles', category: 'gear', essential: true },
      { name: 'Balaclava / neck gaiter', category: 'clothing' },
      { name: 'Après-ski boots / warm shoes', category: 'clothing' },
      { name: 'Lip balm with SPF', category: 'toiletries' },
      { name: 'Sunscreen (mountain sun is fierce)', category: 'toiletries' },
      { name: 'Hand / toe warmers', category: 'gear' },
      { name: 'Casual evening clothes', category: 'clothing' },
    ].map(withDefaults),
  },
  {
    id: 'tpl-roadtrip',
    name: 'Road trip',
    tripType: 'roadtrip',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      ...MILD_CLOTHING,
      { name: "Driver's license", category: 'documents', essential: true },
      { name: 'Vehicle registration / rental contract', category: 'documents' },
      { name: 'Car charger (USB-C / lightning)', category: 'electronics' },
      { name: 'Phone mount for car', category: 'gear' },
      { name: 'Sunglasses', category: 'clothing' },
      { name: 'Snacks + reusable containers', category: 'other' },
      { name: 'Cooler / ice box', category: 'gear' },
      { name: 'Blanket / pillow', category: 'other' },
      { name: 'Emergency roadside kit', category: 'gear' },
      { name: 'Paper map / atlas (backup)', category: 'documents' },
      { name: 'Playlist / podcasts downloaded', category: 'electronics' },
      { name: 'Wet wipes / hand sanitizer', category: 'toiletries' },
    ].map(withDefaults),
  },
  {
    id: 'tpl-family',
    name: 'Family with kids',
    tripType: 'family',
    builtin: true,
    items: [
      ...UNIVERSAL_ESSENTIALS,
      ...UNIVERSAL_TOILETRIES,
      ...UNIVERSAL_CLOTHING_BASE,
      { name: 'Kids clothing (per day + 1)', category: 'kids', essential: true },
      { name: 'Diapers + wipes', category: 'kids' },
      { name: 'Baby food / formula', category: 'kids' },
      { name: 'Bottle + sippy cup', category: 'kids' },
      { name: 'Favourite toy / comfort item', category: 'kids' },
      { name: 'Stroller / carrier', category: 'gear' },
      { name: 'Car seat', category: 'gear' },
      { name: 'Kids medication', category: 'health' },
      { name: 'Snacks for the journey', category: 'other' },
      { name: 'Tablet + downloaded shows', category: 'electronics' },
      { name: 'Colouring books / activities', category: 'kids' },
      { name: 'Sunscreen (kid-safe)', category: 'toiletries', weatherTags: ['sun'] },
      { name: 'Nightlight', category: 'kids' },
    ].map(withDefaults),
  },
]

/** Loosen the input type so we can freely mix SeedItem[] spreads with
 * inline literals whose `category` / `weatherTags` inferred as strings.
 * We narrow back at the boundary — every real usage site uses valid
 * PackingCategory / WeatherTag values. */
type SeedItemLike = {
  name: string
  category: string
  quantity?: number
  essential?: boolean
  weatherTags?: string[]
}

function withDefaults(item: SeedItemLike) {
  return {
    name: item.name,
    category: item.category as PackingCategory,
    quantity: item.quantity ?? 1,
    essential: item.essential ?? false,
    weatherTags: item.weatherTags as WeatherTag[] | undefined,
  }
}

/** Return a template appropriate for the given trip type, or the general
 * template as a fallback. */
export function templateForType(type: TripType): PackingTemplate {
  return (
    BUILT_IN_TEMPLATES.find((t) => t.tripType === type) ??
    BUILT_IN_TEMPLATES[0]
  )
}

/** Filter template items by weather tags. Items with no tags always
 * include; items with tags include only if at least one tag matches. */
export function filterByWeather(
  template: PackingTemplate,
  tags: WeatherTag[],
): PackingTemplate['items'] {
  const tagSet = new Set(tags)
  return template.items.filter((it) => {
    if (!it.weatherTags || it.weatherTags.length === 0) return true
    return it.weatherTags.some((t) => tagSet.has(t))
  })
}
